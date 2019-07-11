import * as https from 'http';
import {createReadStream} from 'fs';
import {gunzip, gunzipSync, gzipSync, createBrotliCompress, brotliCompress, brotliCompressSync} from 'zlib';
import {promisify} from 'util';
import request = require('request');
import {Stream, Writable, Readable} from 'stream';
const gunzipAsync = promisify(gunzip);

function getSizes() {
    request(
        'http://localhost:2423/sizes',
        {method: 'post', json: {files: ['hello.log', 'hey.log']}, auth: {user: 'foo', pass: 'hijack'}},
        (err, res, body) => {
            console.log(body);
        },
    );
}

function upload() {
    const stream = createBrotliCompress();
    request.post(
        'http://localhost:2423/upload?file=hello.log&fromPos=0',
        {
            auth: {user: 'foo', pass: 'hijack'},
            body: stream,
        },

        (err, res, body) => {
            console.log(body);
        },
    );

    const msg = brotliCompressSync('FooBarBaz');
    console.log(msg.length);
    stream.write(msg.slice(0, 3));
    setTimeout(() => {
        stream.write(msg.slice(3, 6));
    }, 500);
    setTimeout(() => {
        stream.end(msg.slice(6));
    }, 1000);
}
upload();
getSizes();
