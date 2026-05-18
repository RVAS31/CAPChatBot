module.exports = function registerUploadTextDocument(srv, deps) {
  const { Documents, JSZip, uuidv4 } = deps;

  srv.on("uploadTextDocument", async (req) => {
    const { fileName, mimeType, contentBase64 } = req.data;

    // The mimeType can be empty in browsers → don't require it
    if (!fileName || !contentBase64) req.error(400, "Missing parameters");

    if (!Documents) req.error(500, "Entity 'Documents' not available in this service. Expose it in CDS.");

    const buffer = Buffer.from(contentBase64, "base64");
    let extractedText = "";

    const lower = fileName.toLowerCase();
    const isTxt = lower.endsWith(".txt") || mimeType === "text/plain";
    const isDocx =
      lower.endsWith(".docx") ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (isTxt) {
      extractedText = buffer.toString("utf8");
    } else if (isDocx) {
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file("word/document.xml")?.async("string");
      if (!documentXml) req.error(400, "Invalid DOCX: word/document.xml not found");

      extractedText = documentXml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
    } else {
      req.error(415, "Only TXT and DOCX supported in MVP");
    }

    const ID = uuidv4();

    await INSERT.into(Documents).entries({
      ID,
      fileName,
      mimeType: mimeType || "",
      size: buffer.length,
      extractedText,
      createdAt: new Date(),
      createdBy: req.user?.id || "anonymous"
    });

    return ID;
  });
};
