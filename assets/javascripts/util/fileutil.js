function FileUtil(document) {

    this.__document = document;

};

FileUtil.prototype.saveAs = function(data, fileName) {
    var saveLink = this.__document.createElementNS("http://www.w3.org/1999/xhtml", "a");
    var canUseSaveLink = "download" in saveLink;
    var getURL = function() {
        return view.URL || view.webkitURL || view;
    }

    var click = function(node) {
        var event = new MouseEvent("click");
        node.dispatchEvent(event);
    }

    var properties = { type: 'text/plain' };

    file = new File([JSON.stringify(data)], fileName, properties);

    var fileURL = URL.createObjectURL(file);

    saveLink.href = fileURL;
    saveLink.download = fileName;

    click(saveLink);

};

FileUtil.prototype.load = function(callback) {
    var loadButton = this.__document.createElementNS("http://www.w3.org/1999/xhtml", "input");

    loadButton.setAttribute("type", "file");

    loadButton.addEventListener('change', function() {
        var files = $(this)[0].files;

        callback(files);

        return false;

    }, false);

    loadButton.click();

};

FileUtil.prototype.encodeImageElement = (imageId) => {
    return new Promise((accept, reject) => {
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

        var canvas = document.createElement('canvas');
        var image = new Image();
        var content = fs.readFileSync(document.getElementById(imageId).src.slice(7));
        var buffer = toArrayBuffer(content);
        var blob = new Blob([buffer], { type: 'image/gif' });
        var image = new Image();

        image.src = URL.createObjectURL(blob);

        image.onload = function() {
            var context = canvas.getContext('2d');

            context.drawImage(image, x, y, w, h, 0, 0, dw, dh);

            sprites[sprite] = new Tile(canvas, type);

        }

        image.onload = function() {
            canvas.height = image.naturalHeight;
            canvas.width = image.naturalWidth;

            var context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

            accept(canvas.toDataURL());

        }

    });

}

FileUtil.prototype.encodeImageSource = async(src) => {

    return new Promise((accept, reject) => {

        var canvas = document.createElement('canvas');
        var image = new Image();

        image.src = src;
        image.crossOrigin = 'anonymous';

        image.onload = function() {
            var context = canvas.getContext('2d');

            canvas.height = image.naturalHeight;
            canvas.width = image.naturalWidth;

            context.drawImage(image, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

            accept(canvas.toDataURL());

        }

    });

};