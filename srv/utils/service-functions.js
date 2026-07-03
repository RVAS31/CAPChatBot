function buildC4CAuthHeader(destC4C) {
    return "Basic " + Buffer
        .from(`${destC4C.username}:${destC4C.password}`)
        .toString("base64");
}

module.exports = {
    buildC4CAuthHeader
};