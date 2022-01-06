let cardTemplate = ejs.compile($('script[data-template="card"]').text(), { client: true });

datepickr(document.getElementById('date-entry'));

document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

let passwords = {};
let secret = uuid();

let password = null;
let file = null;

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
 * Set the Cookie
 * @param {string} name the Cookie name
 * @param {string} value the Cookie value
 */
function setCookie(name, value) {

    window.api.setCookie(name, value);

}

/**
 * Get the Cookie
 * @param {*} name the Cookie Name
 * @param {*} callback the Cookie Callback
 */
function getCookie(name, callback) {

    callback(window.api.getCookie(name));

}

/**
 * Get a uuid v4 (Date/Random)
 * @returns a v4 uuid
 */
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var dt = new Date().getTime();
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);

        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

}

$.fn.Serialize = (passwords) => {

    return new Promise(async(accept, reject) => {

        async function convertImage(src) {
            return new Promise(async(accept, reject) => {
                let imageUtil = new ImageUtil(document);

                if (src.startsWith('blob:') || src.startsWith('data:')) {
                    let encodedImage = await imageUtil.encodeImageSource(src);

                    accept(encodedImage);

                } else {
                    let encodedImage = await imageUtil.encodeImageElement('info-image');

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

        const bf = new Blowfish(password, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
        const encoded = bf.encode(secret);
        const b64Encoded = base64js.fromByteArray(encoded);

        var zip = new JSZip();

        zip.file(SECRET_FILE, b64Encoded);

        for (var entry in entries) {
            zip.file(`${entry}.json`, JSON.stringify(entries[entry]));
        }

        zip.generateAsync({ type: "blob" }).then(async function(blob) {
            var reader = new FileReader();

            reader.onloadend = function() {
                window.api.fs().writeFile(filename, new Uint8Array(reader.result), () => {
                    setCookie('filename', filename);
                    accept("OK");
                });
            }

            reader.readAsArrayBuffer(blob);

        });

    });

}

$.fn.Modify = (uuid) => {

    $('#trash-entry').css('display', 'inline-block');

    let entry = passwords[uuid];
    let b64Decoded = base64js.toByteArray(entry.password);
    let bf = new Blowfish(secret, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
    let safeSecret = bf.decode(b64Decoded, Blowfish.TYPE.STRING);

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

    window.api.quit();

}

/**
 * Copy the password to the clipboard
 * @param {*} uuid the id of the password
 */
$.fn.Password = (uuid) => {
    var entry = passwords[uuid];
    var b64Decoded = base64js.toByteArray(entry.password);
    var bf = new Blowfish(secret, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
    var password = bf.decode(b64Decoded, Blowfish.TYPE.STRING);

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

            window.api.fs().readFile(filename, function(err, data) {
                if (err) throw err;

                var content = {};
                var entries = {};

                JSZip.loadAsync(data).then(async function(zipFile) {
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
        $('#waiting').css('display', 'flex');

        $('#login-connect-close')[0].onclick = () => {
            $('#connect-dialog').css('display', 'none');
        }

        if ($('#file-entry').val().length == 0) {
            throw "File Name field is empty !";
        }

        if ($('#unlock-password').val().length == 0) {
            throw "Password field is empty !";
        }

        password = $('#unlock-password').val();

        let content = await processFile($('#file-entry').val());

        let b64Decoded = base64js.toByteArray(content.secret);

        let bf = new Blowfish(password, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
        secret = bf.decode(b64Decoded, Blowfish.TYPE.STRING);

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
        $('#waiting').css('display', 'none');

    } catch (e) {
        $('#waiting').css('display', 'none');
        $('#connection-message').text(e);

        window.setTimeout(() => {
            $('#connection-message').text("");
        }, 10000);

    }

});

$('#connect-new-file').on('click', async(e) => {

    $('#mainbox').html("");
    $('#connect-dialog').css('display', 'none');
    $('#waiting').css('display', 'none');

});

$('#menu').on('click', (e) => {

    document.getElementById("dropdown").classList.toggle("show");

});

$('#upload-file').on('click', (e) => {
    $('#connection-message').text("");
    $("#connect-dialog").css('display', 'inline-block');
    $('#unlock-password').hideShowPassword(false, true);
});

$('#load').on('click', (e) => {
    $('#connection-message').text("");
    $("#connect-dialog").css('display', 'inline-block');
    $('#unlock-password').hideShowPassword(false, true);

    document.getElementById("dropdown").classList.remove('view');

    return false;

});

$('#cancel-safe')[0].onclick = () => {
    $('#connect-dialog').css('display', 'none');
}

$('#download-file').on('click', (e) => {
    $(this).Download();
});

$('#save').on('click', (e) => {
    $(this).Download();

    document.getElementById("dropdown").classList.remove('view');

    return false;
});

$("#select-file").on('click', async(e) => {
    let result = window.api.showOpenDialog();

    if (!result.canceled) {
        $('#file-entry').val(result.filePaths[0]);
    }

});

$("#save-select-file").on('click', async(e) => {
    let result = window.api.showSaveDialog("untitled.pig");

    if (!result.canceled) {
        $('#save-file-entry').val(result.filePath);
    }

});

$("#save-safe").on('click', async(e) => {

    $('#waiting').css('display', 'flex');

    var password = $('#save-password').val();
    var filename = $('#save-file-entry').val();

    await $.fn.Save(password, secret, passwords, filename);

    $(this).Close('#save-dialog');
    $('#waiting').css('display', 'none');

});

$('#add-entry').on('click', (e) => {

    $('#trash-entry').css('display', 'none');

    $('#entry-status').val('create');
    $('#entry-uuid').val(uuid());
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
    var bf = new Blowfish(secret, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
    var encoded = bf.encode($('#password-entry').val());
    var b64Encoded = base64js.fromByteArray(encoded);

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

$('#clear-entries').on('click', (e) => {

    $('#mainbox').html("");
    passwords = {};

});

$('#clear').on('click', (e) => {

    $('#mainbox').html("");
    passwords = {};

    document.getElementById("dropdown").classList.remove('view');

    return false;

});

$('#trash-entry').on('click', (e) => {

    document.getElementById(`card-${$('#entry-uuid').val()}`).remove();

    console.log(passwords);

    delete passwords[$('#entry-uuid').val()];

    $('#entry-dialog').css('display', 'none');


});

$('#connect-clean').on('click', (e) => {

    $('#file-entry').val('');
    $('#unlock-password').val('');

});

$('#info-button').on('click', (e) => {

    $('#oink')[0].play();

});

$("#window-minimize").on('click', async(e) => {

    window.api.minimize();

});

$("#window-maximize").on('click', async(e) => {
    var isMaximized = window.api.isMaximized();

    if (!isMaximized) {
        $("#window-maximize").addClass("fa-window-restore");
        $("#window-maximize").removeClass("fa-square");
        window.api.maximize();
    } else {
        $("#window-maximize").removeClass("fa-window-restore");
        $("#window-maximize").addClass("fa-square");
        window.api.unmaximize();
    }

});

$("#quit").on('click', async(e) => {

    window.api.quit();

});

$(() => {

    document.addEventListener('dragover', event => event.preventDefault());
    document.addEventListener('drop', event => event.preventDefault());

    $('#login-connect-close')[0].onclick = () => {
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

    dropzone.on('click', () => {
        var loadButton = document.createElementNS("http://www.w3.org/1999/xhtml", "input");

        loadButton.setAttribute("type", "file");

        loadButton.addEventListener('change', function() {
            var files = $(this)[0].files;

            $('#password-image').attr('src', URL.createObjectURL(files[0]));

            return false;

        }, false);

        loadButton.click();

    });

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