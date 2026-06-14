'use strict';

const CompetencyContract = require('./lib/competencyContract');
const AccidentPremiumContract = require('./lib/accidentPremiumContract');
const ResponsibilityContract = require('./lib/responsibilityContract');
const AccidentIntakeContract = require('./lib/accidentIntakeContract');

module.exports.CompetencyContract = CompetencyContract;
module.exports.AccidentPremiumContract = AccidentPremiumContract;
module.exports.ResponsibilityContract = ResponsibilityContract;
module.exports.AccidentIntakeContract = AccidentIntakeContract;

// Contracts exposed by this chaincode package. Caliper / fabric peer address a
// specific contract via its name (the class name) plus the transaction name.
module.exports.contracts = [
  CompetencyContract,
  AccidentPremiumContract,
  ResponsibilityContract,
  AccidentIntakeContract,
];
