sap.ui.define([], function () {
    "use strict";
    const BO = {
        CONTACT: 'Contact',
        OPPORTUNITY: 'Opportunity',
        SALESQUOTE: 'SalesQuote',
        ACCOUNT: 'Account',
        DOCUMENT: 'Document',
        EMPLOYEE: 'Employee',
        WORDINTEGRATIONROOT: 'WordIntegrationRoot'
    };

    //we can change the to our customer url. In the future we can set up that in our Model if it is possible
    //Due to this project has been deployed and set up in ACN then we need to change this URL
    const baseUrl = "https://my1000269.de1.test.crm.cloud.sap"; 

    const subUrl = {
        Contact: '/sap/c4c/api/v1/contact-person-service/',
        Opportunity: '/sap/c4c/api/v1/opportunity-service/opportunities',
        SalesQuote: '/sap/c4c/api/v1/sales-quote-service/salesQuotes',
        Employee: '/sap/c4c/api/v1/employee-service/employees',
        Account: '/sap/c4c/api/v1/account-service/',
        Document: '/sap/c4c/api/v1/document-service/'
    }

    return { BO, baseUrl, subUrl };
});
