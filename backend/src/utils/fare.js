'use strict';

/**
 * individualFare = totalFare / numberOfPassengers
 * Returns null when the admin has not entered the actual fare yet.
 */
function splitFare(totalFare, passengerCount) {
  if (totalFare === null || totalFare === undefined) return null;
  if (!passengerCount) return null;
  return Math.round((totalFare / passengerCount) * 100) / 100;
}

module.exports = { splitFare };
