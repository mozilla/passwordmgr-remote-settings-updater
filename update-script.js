const KintoClient = require("kinto-http").default;
const btoa = require("btoa");
const fetch = require("node-fetch");
const AppConstants = require("./app-constants");

const WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION = "websites-with-shared-credential-backends";
const FX_RS_WRITER_USER = AppConstants.FX_REMOTE_SETTINGS_WRITER_USER;
const FX_RS_WRITER_PASS = AppConstants.FX_REMOTE_SETTINGS_WRITER_PASS;
const SERVER_ADDRESS = AppConstants.FX_REMOTE_SETTINGS_WRITER_SERVER;

const APPLE_API_ENDPOINT = "https://api.github.com/repos/apple/password-manager-resources/contents/quirks/websites-with-shared-credential-backends.json";

/**
 * Fetches the source records from the APPLE_API_ENDPOINT
 *
 * @return {JSON} 
 */
const getSourceRecords = async () => {
  const response = await fetch(APPLE_API_ENDPOINT, {
    headers: {
      "Accept": "application/vnd.github.v3.raw"
    }
  });
  const data = await response.json();
  return data;
}

const arrayEquals = (a, b) => {
  return Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index]);
};

/**
 * Updates the existing record in Remote Settings with the updated data from Apple's GitHub repository
 *
 * @param {KintoClient} client KintoClient instance
 * @param {string} bucket Name of the Remote Settings bucket
 * @param {Object} newRecord Object containing the updated related realms object
 * @param {string} newRecord.id ID from the current related realms object from the Remote Settings server
 * @param {string[][]} newRecord.relatedRealms Updated related realms array from GitHub
 */
const updateRecord = (client, bucket, newRecord) => {
  await client.bucket(bucket).collection(WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION).updateRecord(newRecord);
  const postServerData = await client.bucket(bucket).collection(WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION).getData();
  const setDataObject = {
    status: "to-review",
    last_modified: postServerData.last_modified
  };
  await client.bucket(bucket).collection(WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION).setData(setDataObject, {patch: true});
  console.log(`Found new records, committing changes to ${WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION} collection.`);
};

/**
 * Creates a new record in Remote Settings if there are no records in the WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION
 *
 * @param {KintoClient} client
 * @param {string} bucket
 */
const createRecord = (client, bucket) => {
  let githubRecords = await getSourceRecords();
  const result = await client.bucket(bucket).collection(WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION).createRecord({
    relatedRealms: githubRecords
  });
  const postServerData = await client.bucket(bucket).collection(WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION).getData();
  await client.bucket(bucket).collection(WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION).setData({status: "to-review", last_modified: postServerData.last_modified}, {patch: true});
  console.log("Added new record!", result);
};

/**
 * The runner for the script.
 * 
 * @return {Number} 0 for success, 1 for failure.
 */
const main = async () => {

  const bucket = "main-workspace";
  const secretString = `${FX_RS_WRITER_USER}:${FX_RS_WRITER_PASS}`;
  try {
    const client = new KintoClient(SERVER_ADDRESS, {
      headers: {
        Authorization: "Basic " + btoa(secretString)
      }
    });

    let records = await client.bucket(bucket).collection(WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION).listRecords();
    let data = records.data;

    // If there are existing records in the collection, we need to update instead of creating new records
    if (data.length) {
      let currentRelatedRealms = data[0].relatedRealms;
      let id = data[0].id;
      let areNewRecords = false;
      let githubRecords = await getSourceRecords();
      let newRecord = {
        id: id,
        relatedRealms: githubRecords
      };
      if (githubRecords.length != currentRelatedRealms.length) {
        areNewRecords = true;
      }
      if (areNewRecords) {
        updateRecord(client, bucket, newRecord);
        return 0;
      } else {
        for (let i = 0; i < githubRecords.length; i++) {
          let a = githubRecords[i];
          let b = currentRelatedRealms[i];
          areNewRecords = !arrayEquals(a,b);
          if (areNewRecords) {
            updateRecord(client, bucket, newRecord);
            return 0;
          }
        }
      }
      console.log("No new records! Not committing any changes to Remote Settings collection.");
    } else {
      createRecord(client, bucket);
    }
  } catch (e) {
    console.error(e);
    return 1;
  }
  return 0;
};

main();
