# fileupload-demo
This project demonstrate a file upload API then provide a download link for later access, the files stored on server are encrypted with AES-256.

#API endpoints
- POST /upload
	- Expect `multipart/form-data` 
		- `file`: the file uploaded, required
		- `password`: password for the file, optional
	- Respond with `application/json`, for download link generation
		- Example:`{key: "cd4f420bcf5491d1d414f0f463b6c8d211fca71e"}` 
- GET /dl
	- Parameters
		- `key`: key for access the file
		- `passwd`: optional password for the file

#API workflows

## File upload

1. Receive the file on the server side, it will be put in the temporary directory `os.tmpdir`
2. Use the current epoch time in milliseconds original file name to generate download key using `sha1(timestamp + original name)`
3. Use`mime`package to lookup the MIME type of the file
4. Store the following information into database`{ID, NAME, PASSWORD, MIME}`
5. Respond to user with download key in JSON
6. Start encryption pipe line and store the encrypted file in directory call `fileVault` and using the download key as file name

## File download

1. Use the `key` parameter to retrieve the information from database, if not found return `404`
2. If the `PASSWORD` is not `null`, check if the `passwd` parameter is present and identical as stored, if not return `401`
3. Everything checks out, start the decryption pipe line and stream the file with the stored MIME type and original name for download as an attachment.

#Install and run
```
cd fileupload-demo
npm install
forever start index.js
```
then open the browser at `http://host-name:9000` for UI

#Third party Packages

### Backend
- NodeJS
	- `express` the middleware
	- `multiparty` for `FormData` processing
	- `sqlite3` simple database
	- `mime` mime type lookup

### Frontend
- jQuery
- Bootstrap

#TODOs
- Add a check back later message if user requested file hasn't been encrypted from the temporary storage and put the the vault.
- To enhance security, each file can have it's own random generated key, and we can store the key along with the database.
- In the database table we can also encrypt the user provided password
- User configurable temporary directory and file storage directory, sometimes `os.tmpdir` could be too small

#Final thoughts
>Scalability: what are some of the considerations when you need to create and serve many links in parallel? What if people upload very big files?

NodeJS use `UV_THREADPOOL_SIZE` environmental variable to control the thread pool size for the asynchronous calls, *in theory* the server can serve close to the thread pool size of concurrent upload + download request. In addition to the single `node`process, we can also use `cluster` module to run multiple node processes in the same box. To scale beyond one box, need to have proxy/load balancer to hand off request to designated server.

For big files, since it will occupy worker thread for a long time, we can use the file.size in the request to determine we have enough workers for large files. For example, in each process we only allow 10 threads for processing files larger then 100MB.

>Resiliency: how will you handle errors in various components of your system? How will you recover gracefully?

In the *universal exception handler*, we print out the exception and shutdown the process then let the `forever` process restart the server.