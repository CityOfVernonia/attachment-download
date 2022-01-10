/**
 * Options...
 */
// service url
const featureServiceUrl = 'https://<SERVER>/FeatureServer/0';

// prefix for each feature attachments directory
const directoryPrefix = 'feature';

// log responses (errors always logged)
const log = true;

/**
 * Modules...
 */
require('isomorphic-form-data');
const { setDefaultRequestOptions } = require('@esri/arcgis-rest-request');
const { queryFeatures, getAttachments } = require('@esri/arcgis-rest-feature-layer');
const download = require('download');
const fs = require('fs-extra');
const chalk = require('chalk');
setDefaultRequestOptions({ fetch: require('node-fetch') });

/**
 * Generic error handling.
 * @param {String} message 
 * @param {Error} error
 */
const _error = (message, error) => {
  console.log(
    chalk.red(message)
  );
  console.log(error);
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
      returnUrl: true,
    },
  })
    .then((response) => {
      if (log) console.log(response);

      response.attachmentInfos.forEach((attachmentInfo) => {
        _downloadAttachment(attachmentInfo, id);
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
const _downloadAttachment = (attachmentInfo, id) => {
  const attachmentUrl = `${featureServiceUrl}/${id}/attachments/${attachmentInfo.id}`;

  download(attachmentUrl)
    .then((data) => {
      _writeFile(data, attachmentInfo, id);
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
const _writeFile = (data, attachmentInfo, id) => {
  const { id: attachmentId, name } = attachmentInfo;

  const attachmentDirectory = `attachments/${directoryPrefix}_${id}`;

  const fileParts = name.split('.');

  const [fileName, fileType] = fileParts;

  fs.ensureDir(attachmentDirectory);

  const filePath = `${attachmentDirectory}/${fileName}_${attachmentId}.${fileType}`;

  fs.writeFile(filePath, data, error => {
    if (error) {
      console.log(
        chalk.red(`Failed to write ${filePath}.`)
      );
    } else if (!error && log) {
      console.log(
        chalk.green(`Succesfully wrote ${filePath}.`)
      );
    }
  });
};

/**
 * Ensure attachments directory.
 */
fs.ensureDir('attachments');

/**
 * Begin by querying all object ids.
 */
queryFeatures({
  url: featureServiceUrl,
  returnIdsOnly: true,
})
  .then((response) => {
    if (log) console.log(response);

    response.objectIds.forEach(_getAttachments);
  })
  .catch((error) => {
    _error('_queryFeatures error', error);
  });
