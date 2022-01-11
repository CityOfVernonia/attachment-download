/**
 * Options...
 */
// service url
const featureServiceUrl = 'https://<SERVER>/FeatureServer/0';

// output directory relative to root of project
const outputDirectory = 'attachments';

// prefix for each feature attachments directory
const directoryPrefix = 'feature';

// prefix field for each file and overrides `directoryPrefix`
// indended for non null unique values
// be careful...no value or type checking and will potentially overwrite some files
const prefixField = '';

// single flat output directory
const flat = false;

// create a token to use in requests
const portal = '';
const username = '';
const password = '';

// log responses (errors always logged)
const log = false;

/**
 * Modules...
 */
require('isomorphic-form-data');
const { setDefaultRequestOptions } = require('@esri/arcgis-rest-request');
const { queryFeatures, getAttachments, getFeature } = require('@esri/arcgis-rest-feature-layer');
const { UserSession } = require('@esri/arcgis-rest-auth');
const download = require('download');
const fs = require('fs-extra');
const chalk = require('chalk');
setDefaultRequestOptions({ fetch: require('node-fetch') });

let token;

/**
 * Generic error handling.
 * @param {String} message
 * @param {Error} error
 */
const _error = (message, error) => {
  console.log(chalk.red(message));
  console.log(error);
};

/**
 * Get all object ids.
 */
const _queryFeatureIds = () => {
  queryFeatures({
    url: featureServiceUrl,
    where: '1 = 1',
    returnIdsOnly: true,
    params: {
      token,
    },
  })
    .then((response) => {
      if (log) console.log(response);

      response.objectIds.forEach(_getAttachments);
    })
    .catch((error) => {
      _error('_queryFeatures error', error);
    });
};

/**
 * Get attachments for a feature.
 * @param {Number} id
 */
const _getAttachments = (id) => {
  getAttachments({
    url: featureServiceUrl,
    featureId: id,
    params: {
      token,
    },
  })
    .then((response) => {
      if (log) console.log(response);

      response.attachmentInfos.forEach((attachmentInfo) => {
        if (prefixField) {
          getFeature({
            url: featureServiceUrl,
            id,
            params: {
              token,
            },
          })
            .then((response) => {
              const fieldValue = response.attributes ? response.attributes[prefixField] : null;
              _downloadAttachment(attachmentInfo, id, fieldValue);
            })
            .catch((error) => {
              _error(`_getAttachments#getFeature error...feature id ${id}`, error);
            });
        } else {
          _downloadAttachment(attachmentInfo, id, null);
        }
      });
    })
    .catch((error) => {
      _error(`_getAttachments error...feature id ${id}`, error);
    });
};

/**
 * Download attachment.
 * @param {AttachmentInfo} attachmentInfo
 * @param {Number} id
 */
const _downloadAttachment = (attachmentInfo, id, fieldValue) => {
  let attachmentUrl = `${featureServiceUrl}/${id}/attachments/${attachmentInfo.id}`;

  if (token) attachmentUrl = `${attachmentUrl}?token=${token}`;

  download(attachmentUrl)
    .then((data) => {
      _writeFile(data, attachmentInfo, id, fieldValue);
    })
    .catch((error) => {
      _error(`_downloadAttachment error...attachment url ${attachmentUrl}`, error);
    });
};

/**
 * Write the attachment to disc.
 * @param {Buffer} data
 * @param {AttachmentInfo} attachmentInfo
 * @param {Number} id
 */
const _writeFile = async (data, attachmentInfo, id, fieldValue) => {
  let filePath;
  const { id: attachmentId, name } = attachmentInfo;
  const [fileName, fileType] = name.split('.');
  const writeDirectory = flat === true ? outputDirectory : `${outputDirectory}/${fieldValue || directoryPrefix}_${id}`;

  if (flat === true) {
    filePath = fieldValue
      ? `${writeDirectory}/${fieldValue}_${fileName}_${attachmentId}.${fileType}`
      : `${writeDirectory}/${id}_${fileName}_${attachmentId}.${fileType}`;
  } else {
    filePath = `${writeDirectory}/${fileName}_${attachmentId}.${fileType}`;
  }

  await fs.ensureDir(writeDirectory);

  fs.writeFile(filePath, data, (error) => {
    if (error) {
      _error(`_writeFile error...file path ${filePath}`, error);
    } else if (!error && log) {
      console.log(chalk.green(`Succesfully wrote ${filePath}.`));
    }
  });
};

(async () => {
  await fs.ensureDir(outputDirectory);

  if (portal && username && password) {
    const session = new UserSession({
      username,
      password,
      portal,
    });

    session
      .getToken(featureServiceUrl)
      .then((_token) => {
        token = _token;
        _queryFeatureIds();
      })
      .catch((error) => {
        _error('session.getToken error', error);
      });
  } else {
    _queryFeatureIds();
  }
}).call();
