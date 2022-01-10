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

let objectIdField;

const _error = (message, error) => {
  console.log(
    chalk.red(message)
  );
  console.log(error);
};

const _queryFeatures = () => {
  queryFeatures({
    url: featureServiceUrl,
    returnIdsOnly: true,
  })
    .then((response) => {
      if (log) console.log(response);

      objectIdField = response.objectIdFieldName;

      response.objectIds.forEach(_getAttachments);
    })
    .catch((error) => {
      _error('_queryFeatures error', error);
    });
};


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


fs.ensureDir('attachments');

_queryFeatures();
