const operator = require("./type-operator");

/**
 * to parsed value by doing a recursive algo.
 * @param {value} gets parsed given a value 
 * @returns a parsed value
 */
function getParsedFromValue(value) {
    //the case when we do have a pure object 
    if (typeof value == 'object' && value !== null && !(value instanceof Object && value instanceof Array)) {
        let arrayEntries = Object.entries(value);
        let objectEntries = {};
        for (const [k, v] of arrayEntries) {
            Object.assign(objectEntries, { [k]: getParsedFromValue(v) })
        }
        return objectEntries
        //the case when we do have a not empty array
    } else if (Array.isArray(value) && value.length > 0) {
        let arrayObjects = [];
        for (const index in value) {
            arrayObjects.push(getParsedFromValue(value[index]))
        }
        return arrayObjects
        //the case when we do have aempty array
    } else if (Array.isArray(value) && value.length == 0) {
        return []
        //other case
    } else {
        return value
    }
}

/**
 * 
 * @param {array} array 
 * @param {string} sufix 
 * @param {integer} lastChar 
 * @returns remove some sufix 
 */
function removeSufix(array, sufix, lastChar) {
    array = array.map(item => item.as);
    array = array.map(item => {
        if (item.endsWith(sufix)) {
            return item.slice(0, -lastChar); // Remove the last 3 characters
        }
        return item;
    });
    return array.join(",");
}

/**
 * 
 * @param {string} selectOperator is operator from client
 * @returns converted operator
 */
function getOperator(selectOperator) {
    let operatorT; //Operator translated
    switch (selectOperator) {
        case (operator.TYPE.EQ):
            operatorT = 'eq';
            break;
        case (operator.TYPE.NE):
            operatorT = 'ne';
            break;
        case (operator.TYPE.GT):
            operatorT = 'gt';
            break;
        case (operator.TYPE.GE):
            operatorT = 'ge';
            break;
        case (operator.TYPE.LT):
            operatorT = 'lt';
            break;
        case (operator.TYPE.LE):
            operatorT = 'le';
            break;
        case (operator.TYPE.AND):
            operatorT = 'and';
            break;
        case (operator.TYPE.OR):
            operatorT = 'or';
            break;
        default:
            operatorT = 'eq';
    }
    return operatorT
}

/**
 * 
 * @param {array} filterArray 
 * @param {string} queryString 
 * @returns a concatenated query string
 */
function concatenateQueryFilter(filterArray, queryString) {
    for (let i = 0; i < filterArray.length; i++) {
        if (filterArray[i].ref) {
            queryString += filterArray[i].ref[0];
        } else if (filterArray[i].val) {
            queryString += `'${filterArray[i].val}'`;
        } else {
            queryString += ` ${getOperator(filterArray[i])} `;
        }
    }
    return queryString
}

/**
 * 
 * @param {array} arr is the filter array
 * @returns a flattten array
 */
function flattenArray(arr) {
    let result = [];

    arr.forEach(item => {
        if (Array.isArray(item)) {
            result = result.concat(flattenArray(item));
        } else if (typeof item === 'object' && item !== null) {
            if (item.xpr) {
                result = result.concat(flattenArray(item.xpr));
            } else {
                result.push(item);
            }
        } else {
            result.push(item);
        }
    });

    return result;
}

/**
 * 
 * @param {array} filterArray is filter array
 * @returns true if has contains, startWith and endsWith
 */
function getSearchCondition(filterArray) {
    return filterArray[0].func ? true : false
}

/**
 * 
 * @param {array} filterArray is filter array 
 * @returns the value in the cases of contains, startswith and endswith
 */
function getSearchQuery(filterArray) {
    return filterArray[0].args[1].val;
}

/**
 * 
 * @param {array} filterArray is filter array
 * @returns a concatenated query
 */
function constructQueryFiltersString(filterArray) {
    let queryString = ``;
    return concatenateQueryFilter(flattenArray(filterArray), queryString);
}

module.exports = {
    getSearchCondition,
    getSearchQuery,
    getParsedFromValue,
    removeSufix,
    constructQueryFiltersString
}