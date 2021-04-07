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
 * Fetches the source records from the APPLE_API_ENDPOINT.
 *
 * Since this script should run once every two weeks, we don't need a GitHub token.
 * See also: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting
 * @return {String[][]} The related realms
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
  // ? Why do we ignore the result of the `updateRecord` call?
  await client.bucket(bucket).collection(COLLECTION_ID).updateRecord(newRecord);
  const postServerData = await client.bucket(bucket).collection(COLLECTION_ID).getData();
  const setDataObject = {
    status: "to-review",
    last_modified: postServerData.last_modified
  };
  await client.bucket(bucket).collection(COLLECTION_ID).setData(setDataObject, { patch: true });
  console.log(`Found new records, committed changes to ${COLLECTION_ID} collection.`);
};

/**
 * Creates a new record in Remote Settings if there are no records in the WEBSITES_WITH_SHARED_CREDENTIAL_COLLECTION
 *
 * @param {KintoClient} client
 * @param {string} bucket
 */
const createRecord = async (client, bucket, sourceRecords) => {
  const result = await client.bucket(bucket).collection(COLLECTION_ID).createRecord({
    relatedRealms: sourceRecords
  });
  const postServerData = await client.bucket(bucket).collection(COLLECTION_ID).getData();
  await client.bucket(bucket).collection(COLLECTION_ID).setData({ status: "to-review", last_modified: postServerData.last_modified }, { patch: true });
  console.log(`Added new record to ${COLLECTION_ID}`, result);
};

const printSuccessMessage = () => {
  console.log("Script finished successfully!");
}

/**
 * Determines if there are new records from the GitHub source
 *
 * @param {String[][]} sourceRecords Related realms from Apple's GitHub
 * @param {String[][]} destinationRecords Related realms from Remote Settings
 * @return {Boolean} `true` if there are new records, `false` if there are no new records 
 */
const checkIfNewRecords = (sourceRecords, destinationRecords) => {
  let areNewRecords = false;
  if (sourceRecords.length !== destinationRecords.length) {
    areNewRecords = true;
  }
  for (let i = 0; i < sourceRecords.length; i++) {
    if (areNewRecords) {
      break;
    }
    areNewRecords = !arrayEquals(sourceRecords[i], destinationRecords[i]);
  }
  return areNewRecords;
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
    let githubRecords = await getSourceRecords();
    let id = data[0]?.id;
    // If there is no ID from Remote Settings, we need to create a new record
    if (!id) {
      await createRecord(client, BUCKET, githubRecords);
    } else {
      // If there is an ID, we can compare the source and destination records
      let currentRecords = data[0].relatedRealms;
      let areNewRecords = checkIfNewRecords(githubRecords, currentRecords);
      // If there are new records, we need to update the data of the record using the current ID
      if (areNewRecords) {
        let newRecord = {
          id: id,
          relatedRealms: githubRecords
        };
        await updateRecord(client, BUCKET, newRecord)
      } else {
        console.log("No new records! Not committing any changes to Remote Settings collection.");
      }
    }
  } catch (e) {
    console.error(e);
    return 1;
  }
  printSuccessMessage();
  return 0;
};

main();
