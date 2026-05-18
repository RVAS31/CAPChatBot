module.exports = function registerGetResponseById(srv, deps) {
  const { AICollection } = deps;

  srv.on("getResponseById", async (req) => {
    const { ID } = req.data;
    if (!ID) return req.reject(400, "Parameter ID is required");

    const row = await SELECT.one.from(AICollection).columns("response").where({ ID });
    if (!row) return req.reject(404, `Prompt not found for ID: ${ID}`);

    return row.response;
  });
};
