import * as Express from 'express';
import * as basicAuth from 'express-basic-auth';
import {createWriteStream, readdir, stat} from 'fs';
import * as https from 'http';
import * as mkdirp from 'mkdirp';
import {promisify} from 'util';
import {createBrotliDecompress} from 'zlib';
import {Exception} from '.';

const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);

const express = Express();

const config = {
    port: 2423,
    logDir: 'logs/',
    https: {
        key: '',
        cert: '',
    },
    admin: {
        login: '',
        password: '',
    },
    services: {
        foo: 'hijack',
    },
};

mkdirp.sync(config.logDir);
const server = https.createServer(
    {
        // key: readFileSync(config.https.key, 'utf8'),
        // cert: readFileSync(config.https.cert, 'utf8'),
    },
    express,
);
server.listen(config.port);

const auth = basicAuth({
    users: config.services,
    unauthorizedResponse(req: basicAuth.IBasicAuthedRequest) {
        throw new Exception('Credentials is incorrect', {auth: req.auth});
    },
});

express.post('/sizes', auth, Express.json(), async (req, res, next) => {
    try {
        const files: string[] = req.body.files;
        const {user} = (req as basicAuth.IBasicAuthedRequest).auth;
        const dir = config.logDir + user + '/';
        res.send(await getFileSizes(dir, files));
    } catch (err) {
        next(err);
    }
});

express.post('/upload', auth, async (req, res, next) => {
    try {
        const {file, fromPos} = req.query;
        if (typeof file !== 'string') {
            throw new Exception('file is not specified');
        }
        if (typeof fromPos !== 'string') {
            throw new Exception('fromPos is not specified');
        }
        const {user} = (req as basicAuth.IBasicAuthedRequest).auth;
        const projectDir = config.logDir + user + '/';
        const size = await getFileSize(projectDir, file);
        if (size !== +fromPos) {
            throw new Exception('filePos is not correct', {size, fromPos});
        }
        const stream = createWriteStream(projectDir + file, {flags: 'a'});
        req.pipe(createBrotliDecompress())
            .on('error', err => {
                next(new Exception('Upload error', err));
            })
            .pipe(stream)
            .on('close', () => {
                res.send('ok');
            })
            .on('error', err => {
                next(new Exception('Upload error', err));
            });
    } catch (err) {
        next(err);
    }
});

async function getFileSizes(dir: string, files: string[]) {
    if (!Array.isArray(files) || !files.every(file => typeof file === 'string')) {
        throw new Exception('files is not string array', {files});
    }
    const sizes: (number)[] = [];
    for (const file of files) {
        sizes.push(await getFileSize(dir, file));
    }
    return sizes;
}

async function getFileSize(dir: string, file: string) {
    if (!/^([\w_\-]+)\.log$/.test(file)) {
        throw new Exception('incorrect filename', {file});
    }
    try {
        const info = await statAsync(dir + file);
        if (!info.isFile) {
            throw new Exception('not a file', {file});
        }
        return info.size;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return 0;
        } else {
            throw err;
        }
    }
}
