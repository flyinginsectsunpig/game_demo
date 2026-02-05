const { createServer } = require('@netlify/functions')
const express = require('express')
const serverless = require('serverless-http')
const path = require('path')

const app = express()

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../../dist/public')))

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/public/index.html'))
})

// Create the Netlify function handler
exports.handler = createServer(serverless(app))
