var version      = require( '../package.json').version;
var request      = require( 'request' );
var _            = require( 'lodash' );
var EventEmitter = require( 'events' ).EventEmitter;
var util         = require( 'util' );

function FuelAuth ( options ) {
	'use strict';

	// returning instance if there already is one
	if( !( this instanceof FuelAuth ) ) {
		return new FuelAuth( options );
	}

	//make sure clientId and clientSecret are available and not empty
	if( Boolean( options ) ) {
		if( !options.clientId || !options.clientSecret ) {
			throw new Error( 'clientId or clientSecret is missing or invalid' );
		}

		if( !_.isString( options.clientId ) || !_.isString( options.clientSecret ) ) {
			throw new Error( 'clientId or clientSecret must be strings' );
		}
	} else {
		throw new Error( 'options are required. see readme.' );
	}

	// setting up EventEmitter
	EventEmitter.call( this );

	// set required values
	this.clientId     = options.clientId;
	this.clientSecret = options.clientSecret;
	this.authUrl      = options.authUrl || 'https://auth.exacttargetapis.com/v1/requestToken';
	this.refreshToken = options.refreshToken;
	this.accessToken  = options.accessToken;
	this.expiration   = null;
	this.version      = version;
}

// adding inheriting properties from EventEmitter
util.inherits( FuelAuth, EventEmitter );

FuelAuth.prototype.getAccessToken = function( requestOptions, forceRequest, callback ) {
	'use strict';

	if( this.isExpired() || Boolean( forceRequest ) ) {
		// setting passing request options if necessary
		requestOptions = ( _.isPlainObject( requestOptions ) ) ? requestOptions : {};

		// token is expired, let's get a new one
		this._requestToken( requestOptions, callback );
	} else {
		// token is not expired, let's return the current one
		this._deliverResponse( 'response', { accessToken: this.accessToken, expiresIn: this.expiration - process.hrtime()[0] }, callback );
	}
};

FuelAuth.prototype.isExpired = function() {
	'use strict';

	// if current atomic time is equal or after exp, or we don't have a token, return true
	if( ( this.expiration && this.expiration <= process.hrtime()[0] ) || !this.accessToken ) {
		return true;
	} else {
		return false;
	}
};

FuelAuth.prototype._requestToken = function( requestOptions, callback ) {
	'use strict';

	// set auth options for request
	var options = {
		url: this.authUrl,
		method: 'POST',
		json: {
			clientId: this.clientId,
			clientSecret: this.clientSecret
		}
	};

	_.merge( options, requestOptions ); // deepMerge options received from getAccessToken if they're there

	// adding refresh token to json if it's there
	if( this.refreshToken ) {
		options.json.refreshToken = this.refreshToken;
	}

	// sending request to API
	request( options, function ( err, res, body ) {
		// emitting request error if there is one
		if( err ) {
			this._deliverResponse( 'error', err, callback );
			return;
		}

		// setting variables on object created to be used later
		if( body && body.refreshToken ) {
			this.refreshToken = body.refreshToken;
		}

		this.accessToken = body.accessToken || null;
		this.expiration  = ( body.expiresIn ) ? process.hrtime()[0] + body.expiresIn : null;

		// delivering token for others to use
		this._deliverResponse( 'response', body, callback );

	}.bind( this ) ); // binding function to FuelAuthClient so we can have a good context inside callback
};

FuelAuth.prototype._deliverResponse = function( type, data, callback ) {
	'use strict';

	// if it's a callback, lets use that
	if( _.isFunction( callback ) ) {
		if( type === 'error' ) {
			callback( data, null );
		} else if( type === 'response' ) {
			callback( null, data );
		}
		return;
	}

	this.emit( type, data );
};

// exporting module
module.exports = FuelAuth;