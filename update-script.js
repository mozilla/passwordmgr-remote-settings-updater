const KintoClient = require("kinto-http").default;
const btoa = require("btoa");
const fetch = require("node-fetch");
const AppConstants = require("./app-constants");

const COLLECTION_ID = "websites-with-shared-credential-backends";
/** @type {String} */
const FX_RS_WRITER_USER = AppConstants.FX_REMOTE_SETTINGS_WRITER_USER;
/** @type {String} */
const FX_RS_WRITER_PASS = AppConstants.FX_REMOTE_SETTINGS_WRITER_PASS;
/** @type {String} */
const SERVER_ADDRESS = AppConstants.FX_REMOTE_SETTINGS_WRITER_SERVER;
const BUCKET = "main-workspace";
const APPLE_API_ENDPOINT = "https://api.github.com/repos/apple/password-manager-resources/contents/quirks/websites-with-shared-credential-backends.json";

/**
 * Fetches the source records from the APPLE_API_ENDPOINT
 *
 * @return {String[][]} 
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
const updateRecord = async (client, bucket, newRecord) => {
  await client.bucket(bucket).collection(COLLECTION_ID).updateRecord(newRecord);
  const postServerData = await client.bucket(bucket).collection(COLLECTION_ID).getData();
  const setDataObject = {
    status: "to-review",
    last_modified: postServerData.last_modified
  };
  await client.bucket(bucket).collection(COLLECTION_ID).setData(setDataObject, {patch: true});
  console.log(`Found new records, committed changes to ${COLLECTION_ID} collection.`);
};

/**
 * Creates a new record in Remote Settings if there are no records in the WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION
 *
 * @param {KintoClient} client
 * @param {string} bucket
 */
const createRecord = async (client, bucket) => {
  let githubRecords = await getSourceRecords();
  const result = await client.bucket(bucket).collection(COLLECTION_ID).createRecord({
    relatedRealms: githubRecords
  });
  const postServerData = await client.bucket(bucket).collection(COLLECTION_ID).getData();
  await client.bucket(bucket).collection(COLLECTION_ID).setData({status: "to-review", last_modified: postServerData.last_modified}, {patch: true});
  console.log(`Added new record to ${COLLECTION_ID}`, result);
};

const printSuccessMessage = () => {
  console.log("Script finished successfully!");
}

/**
 * The runner for the script.
 * 
 * @return {Number} 0 for success, 1 for failure.
 */
const main = async () => {
  if (FX_RS_WRITER_USER === "" || FX_RS_WRITER_PASS === "") {
    console.error("No username or password set, quitting!");
    return 1;
  }
  const secretString = `${FX_RS_WRITER_USER}:${FX_RS_WRITER_PASS}`;
  try {
    const client = new KintoClient(SERVER_ADDRESS, {
      headers: {
        Authorization: "Basic " + btoa(secretString)
      }
    });

    let records = await client.bucket(BUCKET).collection(COLLECTION_ID).listRecords();
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
        updateRecord(client, BUCKET, newRecord);
        printSuccessMessage();
        return 0;
      } else {
        for (let i = 0; i < githubRecords.length; i++) {
          let a = githubRecords[i];
          let b = currentRelatedRealms[i];
          areNewRecords = !arrayEquals(a,b);
          if (areNewRecords) {
            updateRecord(client, BUCKET, newRecord);
            printSuccessMessage();
            return 0;
          }
        }
      }
      console.log("No new records! Not committing any changes to Remote Settings collection.");
    } else {
      createRecord(client, BUCKET);
    }
  } catch (e) {
    console.error(e);
    return 1;
  }
  printSuccessMessage();
  return 0;
};

main();
