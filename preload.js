const {
    contextBridge,
    ipcRenderer,
    dialog,
    session
} = require("electron");

const fs = require('fs');
const os = require('os');

contextBridge.exposeInMainWorld(
    "api", {
        quit: () => {
            ipcRenderer.send('quit');
        },
        maximize: () => {
            ipcRenderer.send('maximize');
        },
        unmaximize: () => {
            ipcRenderer.send('unmaximize');
        },
        minimize: () => {
            ipcRenderer.send('minimize');
        },
        isMaximized: () => {
            return ipcRenderer.sendSync('isMaximized');;
        },
        showOpenDialog: () => {
            return ipcRenderer.sendSync('showOpenDialog');
        },
        showSaveDialog: (filename) => {
            return ipcRenderer.sendSync('showSaveDialog', filename);
        },
        showPrintDialog: () => {
            return ipcRenderer.sendSync('showPrintDialog');
        },
        printToPdf: (filename) => {
            return ipcRenderer.send('printToPdf', filename);
        },
        fs: () => {
            return fs;
        },
        os: () => {
            return os;
        },
        path: (url) => {
            return url.slice(os.type() == 'Windows_NT' ? 7 : 6);
        },
        on: (message, callback) => {
            ipcRenderer.on(message, (event, path) => {
                callback()
            });
        },
        getCookie: (name) => {
            return ipcRenderer.sendSync('getCookie', name);
        },
        setCookie: (name, value) => {
            return ipcRenderer.sendSync('setCookie', name, value);          
        },
        log: (message) => {
            console.log(message);
        }

    }

);