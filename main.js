'use strict';

const config = require('./config.json');

const electron = require('electron');
const mime = require('mime');
const path = require('path');
const url = require('url');
const fs = require('fs');
const pug = require('pug');
const os = require('os');

const { app } = electron;
const { protocol } = electron;
const { ipcMain } = electron;
const { dialog } = electron;
const { session } = electron;
const { shell } = electron;
const { webContents } = electron;
const { BrowserWindow } = electron;

var mainWindow = null;

function createWindow() {
    var extend = config.mode == "debug" ? 500 : 0;
    mainWindow = new BrowserWindow({
        width: 1300 + extend,
        height: 800,
        minWidth: 1300 + extend,
        minHeight: 800,
        resizable: true,
        frame: false,
        autoHideMenuBar: true,

        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, "preload.js")
        }

    });

    mainWindow.setMenu(null);

    if (config.mode == "debug") {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.loadURL(`pug:///${path.join(__dirname, 'index.pug')}`);

    mainWindow.on('closed', () => {

        mainWindow = null

    })

}

app.allowRendererProcessReuse = true;

app.on('ready', function() {

    protocol.registerBufferProtocol('pug', function(request, callback) {
        let parsedUrl = new URL(request.url);
        let pathname = path.normalize(path.toNamespacedPath(parsedUrl.pathname).startsWith("\\\\?\\") ?
            parsedUrl.pathname.replace(/^\/*/, '') : parsedUrl.pathname);
        let ext = path.extname(pathname);

        switch (ext) {
            case '.pug':
                var content = pug.renderFile(pathname);

                callback({
                    mimeType: 'text/html',
                    data: new Buffer.from(content)
                });
                break;

            default:
                let output = fs.readFileSync(pathname);

                return callback({ data: output, mimeType: mime.getType(ext) });
        }

    });

    createWindow();

});

app.on('window-all-closed', () => {

    app.quit();

})

app.on('activate', () => {

    if (mainWindow === null) {
        createWindow();
    }

});

ipcMain.on('quit', function(event, arg) {

    app.quit();

});

ipcMain.on('minimize', function(event, arg) {

    mainWindow.minimize();


});

ipcMain.on('isMaximized', function(event, arg) {

    event.returnValue = mainWindow.isMaximized();

});

ipcMain.on('maximize', function(event, arg) {

    mainWindow.maximize();

});

ipcMain.on('unmaximize', function(event, arg) {

    mainWindow.unmaximize();

});

ipcMain.on('showPrintDialog', async function(event, arg) {
    var result = await dialog.showSaveDialog({
            properties: [
                { createDirectory: true }
            ],
            filters: [
                { name: 'pdf', extensions: ['pdf'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        }

    );

    event.returnValue = result;

});

ipcMain.on('printToPdf', function(event, arg) {
    var filePath = arg;

    let win = BrowserWindow.getFocusedWindow();

    //Use default printing options
    win.webContents.printToPDF({}).then(data => {

        fs.writeFile(filePath, data, function(error) {
            event.sender.send('wrote-pdf', filePath)
        })

    })

});

ipcMain.on('showOpenDialog', async function(event) {
    var result = await dialog.showOpenDialog({
            properties: ['openFile', 'createDirectory'],
            filters: [
                { name: 'pig', extensions: ['pig'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        }

    );

    event.returnValue = result;

});

ipcMain.on('showSaveDialog', async function(event, arg) {
    var filename = arg;

    var result = await dialog.showSaveDialog({
            defaultPath: filename,
            properties: [
                { createDirectory: true }
            ],
            filters: [
                { name: 'pig', extensions: ['pig'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        }

    );

    event.returnValue = result;

});

ipcMain.on('openUrl', function(event, arg) {
    var url = arg;

    shell.openExternal(url);

});

ipcMain.on('getCookie', async function(event, name) {
    function getCookie(name) {

        return new Promise(accept => {

            session.defaultSession.cookies.get({
                    url: 'http://pig',
                    name: name
                })
                .then((cookies) => {
                    accept(cookies);
                }).catch((error) => {
                    console.log(error);
                    accept(null);
                });

        });

    }

    event.returnValue = await getCookie(name);

});


ipcMain.on('setCookie', async function(event, name, value) {

    function setCookie(name, value) {

        return new Promise(accept => {
            var maxDate = new Date(8640000000000000);

            session.defaultSession.cookies.set({
                url: 'http://pig',
                name: name,
                value: value,
                expirationDate: maxDate.getTime()
            }).then(() => {
                accept("OK");
            }, (error) => {
                console.error(error);
                accept(error);
            });

        });

    }

    event.returnValue = await setCookie(name, value);

});