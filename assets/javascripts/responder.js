const ipcRenderer = require('electron').ipcRenderer
const app = require('electron').remote.app;
const session = require('electron').remote.session;
const remote = require('electron').remote;
const { dialog } = require('electron').remote;

const fs = require('fs');
const $ = require('jquery');
var Zip = require('jszip');

require('electron-disable-file-drop');
require('hideshowpassword');

const { v1: uuidv1 } = require('uuid');
const blowfish = require('egoroof-blowfish');
const b64 = require('base64-js');

let cardTemplate = ejs.compile($('script[data-template="card"]').text(), { client: true });

datepickr(document.getElementById('date-entry'));
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

let passwords = {};
let secret = uuidv1();
let password = null;
let file = null;
let oink = null;

let SECRET_FILE = '$$$.json';

/**
 * Buffer to Array Buffer
 * @param {*} buf the input buffer
 * @return an Array Buffer
 * 
 */
function toArrayBuffer(buf) {
    var ab = new ArrayBuffer(buf.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }

    return ab;

}

/**
 * Create Audio URL
 * 
 * @param {*} src the Audio Source

 */
function createAudio(src) {
    var content = fs.readFileSync($(`#${src}`)[0].src.slice(7));
    var buffer = toArrayBuffer(content);
    var blob = new Blob([buffer], { type: 'image/gif' });

    return new Audio(URL.createObjectURL(blob))

}

/**
 * Set the Cookie
 * @param {string} name the cookie name
 * @param {string} data the cookie data
 */
function setCookie(name, data) {
    var maxDate = new Date(8640000000000000);

    session.defaultSession.cookies.set({
        url: 'http://pig',
        name: name,
        value: data,
        expirationDate: maxDate.getTime()
    }, function(error) {
        console.log(error);
    });

}

/**
 * Get the Cookie
 * @param {*} name the Cookie Name
 * @param {*} callback the COokie Callback
 */
function getCookie(name, callback) {

    session.defaultSession.cookies.get({
            url: 'http://pig',
            name: name
        })
        .then((cookies) => {
            callback(cookies);
        }).catch((error) => {
            console.log(error)
        })

}
$.fn.Serialize = (passwords) => {

    return new Promise(async(accept, reject) => {

        async function convertImage(src) {
            return new Promise(async(accept, reject) => {
                let fileUtil = new FileUtil(document);

                if (src.startsWith('blob:') || src.startsWith('data:')) {
                    let encodedImage = await fileUtil.encodeImageSource(src);

                    accept(encodedImage);

                } else {
                    let encodedImage = await fileUtil.encodeImageElement('info-image');

                    accept(encodedImage);

                }

            });

        }

        let entries = {};

        for (let item in Object.keys(passwords)) {
            let passwordItem = Object.keys(passwords)[item];
            let entry = {};

            for (let field in Object.keys(passwords[passwordItem])) {
                let fieldItem = Object.keys(passwords[passwordItem])[field];

                if (fieldItem != 'image') {
                    entry[fieldItem] = passwords[passwordItem][fieldItem];
                } else {
                    entry[fieldItem] = await convertImage(passwords[passwordItem][fieldItem]);
                }

            };

            entries[passwordItem] = entry;

        };

        accept(entries);

    });

}

$.fn.Save = async(password, secret, passwords, filename) => {

    return new Promise(async(accept) => {
        var entries = await $(this).Serialize(passwords);

        const bf = new blowfish(password, blowfish.MODE.ECB, blowfish.PADDING.NULL);
        const encoded = bf.encode(secret);
        const b64Encoded = b64.fromByteArray(encoded);

        var zip = new Zip();

        zip.file(SECRET_FILE, b64Encoded);

        for (var entry in entries) {
            zip.file(`${entry}.json`, JSON.stringify(entries[entry]));
        }

        zip
            .generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream(filename))
            .on('finish', function() {
                accept("OK");
            });

    });

}

$.fn.Modify = (uuid) => {

    $('#trash-entry').css('display', 'inline-block');

    let entry = passwords[uuid];
    let b64Decoded = b64.toByteArray(entry.password);
    let bf = new blowfish(secret, blowfish.MODE.ECB, blowfish.PADDING.NULL);
    let safeSecret = bf.decode(b64Decoded, blowfish.TYPE.STRING);

    $('#entry-status').val('modify');
    $('#entry-uuid').val(uuid);
    $('#title-entry').val(entry.name);
    $('#date-entry').val(entry.dataTransfer);
    $('#userid').val(entry.userid);
    $('#password-entry').val(safeSecret);
    $('#url').val(entry.url);
    $('#note').val(entry.note);
    $('#email-entry').val(entry.email);
    $('#password-image').attr('src', entry.image);
    $('#entry-dialog').css('display', 'block');
    $('#password-entry').hideShowPassword(false, true);

}

$.fn.Trash = (id) => {}

$.fn.Close = (id) => {

    $(id).css('display', 'none');

}


$.fn.Quit = (id) => {

    app.exit();

}

/**
 * Copy the password to the clipboard
 * @param {*} uuid the id of the password
 */
$.fn.Password = (uuid) => {
    var entry = passwords[uuid];
    var b64Decoded = b64.toByteArray(entry.password);
    var bf = new blowfish(secret, blowfish.MODE.ECB, blowfish.PADDING.NULL);
    var password = bf.decode(b64Decoded, blowfish.TYPE.STRING);

    let temp = $("<input>");

    $("body").append(temp);
    temp.val(password).select();
    document.execCommand("copy");
    temp.remove();

};

$.fn.Download = () => {

    $('#save-file-entry').val($('#file-entry').val());
    $('#save-password').val($('#unlock-password').val());
    $('#save-dialog').css('display', 'inline-block');
    $('#save-password').hideShowPassword(false, true);

};

$('#unlock-safe').on('click', async(e) => {

    function processFile(filename) {

        function getBlob(file) {

            return new Promise(resolve => {
                file.async("blob").then(function(blob) {
                    resolve(blob);
                });

            });

        }

        function readBlob(url) {

            return new Promise(resolve => {
                var reader = new FileReader();

                reader.onload = function() {
                    resolve(reader.result);
                }

                reader.readAsText(url);

            });

        }

        return new Promise((accept, reject) => {

            fs.readFile(filename, function(err, data) {
                if (err) throw err;

                var content = {};
                var entries = {};

                Zip.loadAsync(data).then(async function(zipFile) {
                    var files = zipFile.file(/.*/);
                    var secret = "";

                    for (var iFile = 0; iFile < files.length; iFile++) {
                        var file = files[iFile];

                        var blobUrl = await getBlob(file);
                        var blob = await readBlob(blobUrl);

                        if (file['name'] == SECRET_FILE) {
                            secret = blob;
                        } else {
                            entries[file['name'].replace('.json', '')] = JSON.parse(blob);
                        }

                    }

                    content['secret'] = secret;
                    content['entries'] = entries;

                    accept(content);

                });

            });

        });

    }

    try {
        $('#login-connect-close')[0].onclick = () => {
            $('#connect-dialog').css('display', 'none');
        }

        $('#cancel-safe')[0].onclick = () => {
            $('#connect-dialog').css('display', 'none');
        }

        if ($('#unlock-password').val().length == 0 && $('#file-entry').val() != "") {
            throw "Password field is empty !";
        }

        password = $('#unlock-password').val();

        if ($('#file-entry').val() == "") {
            $('#mainbox').html("");
            $('#connect-dialog').css('display', 'none');

            return;
        }

        let content = await processFile($('#file-entry').val());

        let b64Decoded = b64.toByteArray(content.secret);

        let bf = new blowfish(password, blowfish.MODE.ECB, blowfish.PADDING.NULL);
        secret = bf.decode(b64Decoded, blowfish.TYPE.STRING);

        if (!(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(secret))) {
            throw "Invalid Password";
        }

        let names = [];

        passwords = content.entries;

        let keys = Object.keys(passwords);

        for (let key in keys) {
            names.push({
                key: keys[key],
                name: passwords[keys[key]].name
            });
        }

        names.sort((a, b) => { return b.name > a.name ? 1 : b.name < a.name ? -1 : 0 });

        let html = "";

        for (let name in names) {
            let key = names[name].key;
            let card = cardTemplate({
                uuid: key,
                name: passwords[key].name,
                image: passwords[key].image
            });

            html = card + html;

        }

        setCookie('filename', $('#file-entry').val());

        $('#mainbox').html(html);
        $('#connect-dialog').css('display', 'none');

    } catch (e) {
        $('#connection-message').text(e);

        window.setTimeout(() => {
            $('#connection-message').text("");
        }, 1000);

    }

});

$('#menu').on('click', (e) => {

    document.getElementById("dropdown").classList.toggle("show");

});

$('#upload-file').on('click', (e) => {
    $('#connection-message').text("");
    $("#connect-dialog").css('display', 'inline-block');

});

$('#download-file').on('click', (e) => {
    $(this).Download();
});

$('#save').on('click', (e) => {
    $(this).Download();
});

$("#select-file").on('click', async(e) => {
    var result = await dialog.showOpenDialog({
            properties: ['openFile'],
            multiSelections: false,
            filters: [
                { name: 'Pig', extensions: ['pig'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        },

    );

    if (!result.canceled) {
        $('#file-entry').val(result.filePaths[0]);
    }

});


$("#save-select-file").on('click', async(e) => {
    var result = await dialog.showSaveDialog({
            properties: [
                { createDirectory: true }
            ],
            filters: [
                { name: 'Pig', extensions: ['pig'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        },

    );

    if (!result.canceled) {
        $('#save-file-entry').val(result.filePath);
    }

});

$("#save-safe").on('click', async(e) => {
    var password = $('#save-password').val();
    var filename = $('#save-file-entry').val();

    await $.fn.Save(password, secret, passwords, filename);

    $(this).Close('#save-dialog');

});

$('#add-entry').on('click', (e) => {

    $('#trash-entry').css('display', 'none');

    $('#entry-status').val('create');
    $('#entry-uuid').val(uuidv1());
    $('#title-entry').val('');
    $('#date-entry').val('');
    $('#userid').val('');
    $('#password-entry').val('');
    $('#email-entry').val('');
    $('#url').val('');
    $('#note').val('');

    $('#password-image').attr('src', 'assets/images/picture.svg');
    $('#entry-dialog').css('display', 'block');
    $('#password-entry').hideShowPassword(false, true);

});

$('#update-entry').on('click', (e) => {
    var bf = new blowfish(secret, blowfish.MODE.ECB, blowfish.PADDING.NULL);
    var encoded = bf.encode($('#password-entry').val());
    var b64Encoded = b64.fromByteArray(encoded);

    passwords[$('#entry-uuid').val()] = {
        name: $('#title-entry').val(),
        image: $('#password-image').attr('src'),
        password: b64Encoded,
        email: $('#email-entry').val(),
        url: $('#url').val(),
        userid: $('#userid').val(),
        date: $('#date-entry').val(),
        note: $('#note').val(),
    }

    $('#entry-dialog').css('display', 'none');

    let image = $('#password-image').attr('src') == 'assets/images/picture.svg' ?
        'assets/images/pig.png' : $('#password-image').attr('src');

    if ($('#entry-status').val() == "create") {
        var card = cardTemplate({
            uuid: $('#entry-uuid').val(),
            name: $('#title-entry').val(),
            image: image
        });

        var html = card + $('#mainbox').html();
        $('#mainbox').html(html);

    } else {
        let uuid = $('#entry-uuid').val();
        $(`#img-${uuid}`)[0].src = image;
        $(`#label-${uuid}`).text($('#title-entry').val());
    }

});

$('#change').on('click', (e) => {

    $('#change-dialog').css('display', 'inline-block');
    $('#new-password').hideShowPassword(false, true);

    document.getElementById("dropdown").classList.remove('view');

    return false;

});

$('#change-password').on('click', (e) => {

    if (!$('#newPassword').val() || $('#newPassword').val() == "") {
        $('#connection-change-message').html("<b>No</b> Passphrase entered");

        return;

    }

    $('#change-dialog').css('display', 'none');

});

$('#trash-entry').on('click', (e) => {

    document.getElementById(`card-${$('#entry-uuid').val()}`).remove();

    $('#entry-dialog').css('display', 'none');


});

$('#connect-clean').on('click', (e) => {

    $('#file-entry').val('');

});

$('#info-button').on('click', (e) => {

    oink.play();

});

$("#window-minimize").on('click', async(e) => {
    var window = remote.getCurrentWindow();

    window.minimize();

});


$("#window-maximize").on('click', async(e) => {
    var window = remote.getCurrentWindow();

    if (!window.isMaximized()) {
        $("#window-maximize").addClass("fa-window-restore");
        $("#window-maximize").removeClass("fa-square");
        window.maximize();
    } else {
        $("#window-maximize").removeClass("fa-window-restore");
        $("#window-maximize").addClass("fa-square");
        window.unmaximize();
    }

});

$("#quit").on('click', async(e) => {

    app.quit();

});

$(() => {

    $('#unlock-password').hideShowPassword(false, true);
    oink = createAudio('oink');

    $('#login-connect-close')[0].onclick = () => {
        $(this).Quit('#connect-dialog');
    }

    $('#cancel-safe')[0].onclick = () => {
        $(this).Quit('#connect-dialog');
    }

    window.onclick = event => {

        if (document.getElementById("dropdown").classList.contains('show')) {
            document.getElementById("dropdown").classList.remove('show');
            document.getElementById("dropdown").classList.toggle("view");
        } else if (document.getElementById("dropdown").classList.contains('view')) {
            document.getElementById("dropdown").classList.remove('view');
        }

    }

    $('#password').hideShowPassword(false, true);

    var dropzone = $('#droparea');

    dropzone.on('dragover', () => {
        dropzone.addClass('hover');
        return false;
    });

    dropzone.on('dragleave', () => {
        dropzone.removeClass('hover');
        return false;
    });

    dropzone.on('drop', (e) => {
        /**
         * Process the Files
         * @param {*} files the Files to process
         */
        function processFiles(files) {
            var fileURL = URL.createObjectURL(files[0]);

            $('#password-image').attr('src', fileURL);

        }

        e.stopPropagation();
        e.preventDefault();
        dropzone.removeClass('hover');

        //retrieve uploaded files data
        var files = e.originalEvent.dataTransfer.files;
        processFiles(files);

        return false;

    });

    getCookie('filename', (cookies) => {
        if (cookies != null && cookies.length != 0 && (JSON.stringify(cookies[0].value)).length != 0) {
            $('#file-entry').val(cookies[0].value);
        }

    });

});