function ImageUtil(document) {

    this.__document = document;

}

ImageUtil.prototype.encodeImageElement = (imageId) => {
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
        console.log(document.getElementById(imageId).src);

        var image = new Image();

        image.src = document.getElementById(imageId).src;

        image.onload = function() {
            canvas.height = image.naturalHeight;
            canvas.width = image.naturalWidth;

            var context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

            accept(canvas.toDataURL());

        }

    });

}

ImageUtil.prototype.encodeImageSource = async(src) => {

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