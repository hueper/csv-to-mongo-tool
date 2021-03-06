process.title = 'node_csv_mongo_import'

const csv = require('csvtojson')
const fs = require('fs')
const _ = require('lodash')
const mongoose = require('mongoose')
const shortid = require('shortid')

const {MONGO_URI, CSV_FILE, MODEL_NAME} = process.env
const log = console.log

if (!MONGO_URI || !CSV_FILE || !MODEL_NAME) {
  log(`
  Usage:
    MONGO_URI=mongodb://localhost/petdb CSV_FILE=mypets.csv MODEL_NAME=Pets node import.js
`)
  process.exit(1)
}

const start = +new Date()

var schema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `${MODEL_NAME.substring(0, 3).toLowerCase()}-${shortid()}`
  }
}, { strict: false });
schema.index({text: 'text'});

const Model = mongoose.model(MODEL_NAME, schema)

log({ MONGO_URI, CSV_FILE })

let cursor = 0

mongoose.connect(MONGO_URI)
  .then(() => {
    log('Parsing csv to objects...')

    return new Promise((resolve, reject) => {
      csv()
        .fromStream(fs.createReadStream(CSV_FILE))
        .subscribe((json) => {
          cursor++
          log(`Importing line: ${cursor}`)

          return new Model(preprocess(json)).save()
        }, reject, resolve)
    })
  })
  .then(() => {
    const runtime = (+new Date() - start) / 1000 / 60
    log(`Done in ${runtime.toFixed(2)} minutes`)

    process.exit(0)
  })
  .catch((err) => {
    log(err)
    process.exit(1)
  })

function preprocess (json) {
  // camelCase keys
  json = _.mapKeys(json, (v, k) => _.camelCase(k))

  let value

  Object.keys(json).forEach((k) => {
    value = json[k].trim()

    if (value) {
      if (k.toLowerCase().includes('date')) {
        value = new Date(json[k])
      } else if (isNumeric(json[k])) {
        value = parseFloat(json[k], 10)
      }
    } else if (value === null || value === '') {
      delete json[k]
      return
    }

    json[k] = value
  })

  return json
}

function isNumeric (n) {
  return !isNaN(n) && n !== ''
}
