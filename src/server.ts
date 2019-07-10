import * as https from 'http';
import {readFileSync, readdir, readFile, stat} from 'fs';
import * as Express from 'express';
import * as mkdirp from 'mkdirp';
import {promisify} from 'util';
import {Exception, ClientException} from '.';
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

const projects = new Set(Object.keys(config.services));

const server = https.createServer(
    {
        // key: readFileSync(config.https.key, 'utf8'),
        // cert: readFileSync(config.https.cert, 'utf8'),
    },
    express,
);
server.listen(config.port);

express.post('/sizes', Express.json(), async (req, res, next) => {
    try {
        const project: string = req.body.project;
        const files: string[] = req.body.files;
        res.send(await getFileSizes(getProjectDir(project), files));
    } catch (err) {
        next(err);
    }
});

function getProjectDir(project: string) {
    if (typeof project !== 'string') {
        throw new Exception('Project is not specified');
    }
    if (!projects.has(project)) {
        throw new Exception('Project is not exists', {project});
    }
    return config.logDir + project + '/';
}

async function getFileSizes(dir: string, files: string[]) {
    if (!Array.isArray(files) || !files.every(file => typeof file === 'string')) {
        throw new Exception('files is not string array', {files});
    }
    const sizes: (number)[] = [];
    for (const file of files) {
        if (!/^([\w_\-]+)\.log$/.test(file)) {
            throw new Exception('incorrect filename', {file});
        }
        try {
            const info = await statAsync(dir + file);
            if (!info.isFile) {
                throw new Exception('not a file', {file});
            }
            sizes.push(info.size);
        } catch (err) {
            if (err.code === 'ENOENT') {
                sizes.push(0);
            } else {
                throw err;
            }
        }
    }
    return sizes;
}
