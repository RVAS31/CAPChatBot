const { extractTextFromBuffer } = require("../utils/documentExtraction");

module.exports = function registerUploadTextDocument(srv, deps) {

  const {
    Documents,
    JSZip,
    uuidv4
  } = deps;

  srv.on("uploadTextDocument", async (req) => {

    const {
      fileName,
      mimeType,
      contentBase64
    } = req.data;

    if (!fileName || !mimeType || !contentBase64) {
      req.error(400, "Missing parameters");
    }

    const buffer = Buffer.from(contentBase64, "base64");

    const extractedText = await extractTextFromBuffer(
      buffer,
      fileName,
      mimeType,
      JSZip
    );

    const ID = uuidv4();

    await INSERT.into(Documents).entries({
      ID,
      fileName,
      mimeType,
      size: buffer.length,
      extractedText,
      createdAt: new Date(),
      createdBy: req.user?.id || "anonymous"
    });

    return ID;
  });
};