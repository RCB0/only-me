const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 9352;

// Middleware
app.use(express.static('views'));
app.use(bodyParser.urlencoded({ extended: true }));

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Serve index.html with file list
app.get('/', (req, res) => {
  fs.readdir(path.join(__dirname, 'uploads'), (err, files) => {
    if (err) {
      res.send('Error reading files');
      return;
    }
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>File Uploader</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background-color: #f4f4f4; }
            #progressBar { width: 100%; background-color: #f3f3f3; border: 1px solid #ccc; margin-top: 10px; }
            #progress { height: 20px; background-color: #4caf50; width: 0%; position: relative; }
            #progressText { position: absolute; width: 100%; text-align: center; line-height: 20px; color: #fff; font-weight: bold; }
          </style>
      </head>
      <body>
          <h1>File Uploader</h1>
          <form id="uploadForm" action="/upload" method="post" enctype="multipart/form-data">
              <input type="file" name="file" />
              <button type="submit">Upload</button>
          </form>
          <div id="progressBar">
              <div id="progress">
                  <div id="progressText">0%</div>
              </div>
          </div>
          <h2>Uploaded Files</h2>
          <table id="fileList">
              <tr>
                  <th>Filename</th>
                  <th>Actions</th>
              </tr>
              ${files.map(file => `
                <tr>
                    <td>${file}</td>
                    <td>
                        <a href="/download/${file}">Download</a> |
                        <a href="/rename/${file}">Rename</a> |
                        <a href="/delete/${file}">Delete</a>
                    </td>
                </tr>
              `).join('')}
          </table>
          <script>
              // Handle form submission with AJAX
              document.getElementById('uploadForm').addEventListener('submit', function(event) {
                  event.preventDefault(); // Prevent the form from submitting the default way

                  const formData = new FormData(this);
                  const xhr = new XMLHttpRequest();
                  xhr.open('POST', '/upload', true);

                  // Update progress bar
                  xhr.upload.onprogress = function(e) {
                      if (e.lengthComputable) {
                          const percentComplete = (e.loaded / e.total) * 100;
                          const progress = document.getElementById('progress');
                          const progressText = document.getElementById('progressText');
                          progress.style.width = percentComplete + '%';
                          progressText.textContent = Math.round(percentComplete) + '%';
                      }
                  };

                  xhr.onload = function() {
                      if (xhr.status === 200) {
                          // Reload the file list after upload
                          loadFileList();
                      } else {
                          console.error('Upload failed');
                      }
                  };

                  xhr.send(formData);
              });

              // Load file list
              function loadFileList() {
                  const xhr = new XMLHttpRequest();
                  xhr.open('GET', '/', true);
                  xhr.onload = function() {
                      if (xhr.status === 200) {
                          const parser = new DOMParser();
                          const doc = parser.parseFromString(xhr.responseText, 'text/html');
                          const fileListHtml = doc.querySelector('table').innerHTML;
                          document.getElementById('fileList').innerHTML = fileListHtml;
                      }
                  };
                  xhr.send();
              }

              // Initial load of file list
              loadFileList();
          </script>
      </body>
      </html>
    `);
  });
});

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  res.send('File uploaded successfully');
});

// Handle file download
app.get('/download/:filename', (req, res) => {
  const file = path.join(__dirname, 'uploads', req.params.filename);
  res.download(file);
});

// Handle file rename
app.get('/rename/:filename', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rename File</title>
    </head>
    <body>
        <h1>Rename File</h1>
        <form action="/rename" method="post">
            <input type="hidden" name="oldName" value="${req.params.filename}" />
            <label for="newName">New Filename:</label>
            <input type="text" id="newName" name="newName" required />
            <button type="submit">Rename</button>
        </form>
        <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

app.post('/rename', (req, res) => {
  const oldName = req.body.oldName;
  const newName = req.body.newName;
  const oldPath = path.join(__dirname, 'uploads', oldName);
  const newPath = path.join(__dirname, 'uploads', newName);

  fs.rename(oldPath, newPath, err => {
    if (err) {
      res.send('Error renaming file');
      return;
    }
    res.redirect('/');
  });
});

// Handle file delete
app.get('/delete/:filename', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Delete File</title>
    </head>
    <body>
        <h1>Delete File</h1>
        <form action="/delete" method="post">
            <input type="hidden" name="filename" value="${req.params.filename}" />
            <label for="confirmation">Type "DELETE" to confirm:</label>
            <input type="text" id="confirmation" name="confirmation" required />
            <button type="submit">Delete</button>
        </form>
        <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});

app.post('/delete', (req, res) => {
  const filename = req.body.filename;
  const confirmation = req.body.confirmation;
  
  if (confirmation !== 'DELETE') {
    res.send('Confirmation text is incorrect');
    return;
  }

  const filePath = path.join(__dirname, 'uploads', filename);

  fs.unlink(filePath, err => {
    if (err) {
      res.send('Error deleting file');
      return;
    }
    res.redirect('/');
  });
});
// Get file list as JSON
app.get('/files', (req, res) => {
  fs.readdir(path.join(__dirname, 'uploads'), (err, files) => {
    if (err) {
      res.status(500).send('Error reading files');
      return;
    }
    res.json(files);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
