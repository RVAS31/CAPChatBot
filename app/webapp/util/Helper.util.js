sap.ui.define([
], function () {
    "use strict";

    return {

        /**
         * to report text to html
         * @param {*} sText 
         * @returns 
         */
        reportTextToHtml: function (sText) {
            const esc = (s) => (s ?? "").toString()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");

            // Keep formatting: use <pre> for monospace + preserve line breaks
            return `
            <html>
            <body style="font-family: Arial, sans-serif; font-size: 14px;">
                <p>Hello,</p>
                <p>Please find the AI-generated report below:</p>
                <pre style="background:#f7f7f7; border:1px solid #ddd; padding:12px; white-space:pre-wrap;">${esc(sText)}</pre>
                <p>Best regards,</p>
            </body>
            </html>
        `;
        },

        /**
         * To build and download eml html
         * @param {*} opts 
         */
        buildAndDownloadEmlHtml: function (opts) {
            const {
                to = "",
                cc = "",
                bcc = "",
                subject = "",
                plainText = "",
                html = "",
                attachments = [] // optional, can be empty
            } = opts || {};

            const CRLF = "\r\n";
            const now = new Date().toUTCString();

            const encHeaderUtf8B64 = (s) => {
                const utf8 = new TextEncoder().encode((s ?? "").toString());
                let bin = "";
                utf8.forEach(b => bin += String.fromCharCode(b));
                return `=?UTF-8?B?${btoa(bin)}?=`;
            };

            const wrapB64 = (b64) => (b64.match(/.{1,76}/g) || []).join(CRLF);

            const b64Utf8 = (s) => {
                const utf8 = new TextEncoder().encode((s ?? "").toString());
                let bin = "";
                utf8.forEach(b => bin += String.fromCharCode(b));
                return btoa(bin);
            };

            // If you also want attachments, we'll create multipart/mixed containing multipart/alternative
            const hasAttachments = attachments && attachments.length > 0;

            const boundaryMixed = "----=_Mixed_" + Math.random().toString(36).slice(2);
            const boundaryAlt = "----=_Alt_" + Math.random().toString(36).slice(2);

            let eml =
                `Date: ${now}${CRLF}` +
                `X-Unsent: 1${CRLF}` + 
                (to ? `To: ${to}${CRLF}` : "") +
                (cc ? `Cc: ${cc}${CRLF}` : "") +
                (bcc ? `Bcc: ${bcc}${CRLF}` : "") +
                `Subject: ${encHeaderUtf8B64(subject)}${CRLF}` +
                `MIME-Version: 1.0${CRLF}`;

            if (!hasAttachments) {
                // multipart/alternative only
                eml += `Content-Type: multipart/alternative; boundary="${boundaryAlt}"${CRLF}${CRLF}`;

                eml +=
                    `--${boundaryAlt}${CRLF}` +
                    `Content-Type: text/plain; charset="UTF-8"${CRLF}` +
                    `Content-Transfer-Encoding: 8bit${CRLF}${CRLF}` +
                    (plainText ?? "") + CRLF;

                eml +=
                    `--${boundaryAlt}${CRLF}` +
                    `Content-Type: text/html; charset="UTF-8"${CRLF}` +
                    `Content-Transfer-Encoding: 8bit${CRLF}${CRLF}` +
                    (html ?? "") + CRLF;

                eml += `--${boundaryAlt}--${CRLF}`;
            } else {
                // multipart/mixed with alternative as first part
                eml += `Content-Type: multipart/mixed; boundary="${boundaryMixed}"${CRLF}${CRLF}`;

                // Alternative part wrapper
                eml +=
                    `--${boundaryMixed}${CRLF}` +
                    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"${CRLF}${CRLF}`;

                eml +=
                    `--${boundaryAlt}${CRLF}` +
                    `Content-Type: text/plain; charset="UTF-8"${CRLF}` +
                    `Content-Transfer-Encoding: 8bit${CRLF}${CRLF}` +
                    (plainText ?? "") + CRLF;

                eml +=
                    `--${boundaryAlt}${CRLF}` +
                    `Content-Type: text/html; charset="UTF-8"${CRLF}` +
                    `Content-Transfer-Encoding: 8bit${CRLF}${CRLF}` +
                    (html ?? "") + CRLF;

                eml += `--${boundaryAlt}--${CRLF}`;

                // Attachments
                for (const a of attachments) {
                    const filename = a.filename || "attachment.txt";
                    const contentType = a.contentType || "text/plain; charset=UTF-8";
                    const b64 = b64Utf8(a.contentText || "");

                    eml +=
                        `--${boundaryMixed}${CRLF}` +
                        `Content-Type: ${contentType}${CRLF}` +
                        `Content-Transfer-Encoding: base64${CRLF}` +
                        `Content-Disposition: attachment; filename="${filename}"${CRLF}${CRLF}` +
                        wrapB64(b64) + CRLF;
                }

                eml += `--${boundaryMixed}--${CRLF}`;
            }

            // Download
            const safeName = (subject || "email").toString().trim().slice(0, 60).replace(/[^\w\-]+/g, "_");
            const filename = `${safeName || "email"}.eml`;

            const blob = new Blob([eml], { type: "message/rfc822;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }


    };
});