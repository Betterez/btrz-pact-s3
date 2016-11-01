"use strict";

const AWS = require("aws-sdk"),
fs = require("fs"),
path = require('path'),
url = require('url');

class BtrzPactS3 {
	
	constructor(options, logger) {
		if (!options) {
			throw new Error("BtrzPactS3 options are mandatory.")
		}
		if (!options.accessKeyId) {
			throw new Error("BtrzPactS3 options.accessKeyId is mandatory.")
		}
		if (!options.secretAccessKey) {
			throw new Error("BtrzPactS3 options.secretAccessKey is mandatory.")
		}
		if (!options.bucket) {
			throw new Error("BtrzPactS3 options.bucket is mandatory.")
		}
		if (logger && !logger.error) {
			throw new Error("BtrzPactS3 logger is not valid.")
		}
		this.accessKeyId = options.accessKeyId;
		this.secretAccessKey = options.secretAccessKey;
		this.bucket = options.bucket;
		this.logger = logger;
	}

	publishSinglePact(pact, _s3Client_) {
		return this.getFileKey(pact)
		.then((key) => {
			if (this.logger) {
				this.logger.info(`BtrzPactS3::publishPacts() - Uploading ${key}`);    
			}

			let s3Client = _s3Client_ || new AWS.S3({
				accessKeyId: this.accessKeyId,
				secretAccessKey: this.secretAccessKey
			});

			let self = this;
			function resolver(resolve, reject) {
				s3Client.putObject(
				{
					Bucket: self.bucket,
					Key: key,
					ACL: "public-read",
					Body: fs.createReadStream(pact)
				},
				function (err, result) {
					if (err) {
						return reject(err);
					}
					return resolve();
				}
				);
			}

			return new Promise(resolver);
		})
		.catch((err) => {
			if (this.logger) {
				this.logger.error("Error on BtrzPactS3::publishSinglePact()", err);
			}
			throw err;
		});
	}

	getFilesFromPath(dir) {
		let self = this;

		var walk = function(dir, cb) {
			var results = [];
			fs.stat(dir, (err, stat) => {
				if (stat && stat.isFile()) {
					results.push(dir);
					return cb(null, results);
				} else {
					fs.readdir(dir, (err, list) => {
						if (err) {
							return cb(err);
						}

						var pending = list.length;
						if (!pending) {
							return cb(null, results);
						}

						list.forEach(function(file) {
							file = path.resolve(dir, file);
							fs.stat(file, (err, stat) => {
								if (stat && stat.isDirectory()) {
									walk(file, (err, res) => {
										results = results.concat(res);
										if (!--pending) {
											return cb(null, results);
										}
									});
								} else {
									results.push(file);
									if (!--pending) {
										return cb(null, results);
									}
								}
							});
						});
					});
				}
			});
		};

		function resolver(resolve, reject) {
			walk(dir, function promisify(err, results) {
				if (err && !results) {
					if (self.logger) {
						self.logger.error("Error on BtrzPactS3::getFilesFromPath()", err);
					}
					return reject(err);
				}
				return resolve(results);
			});
		}

		return new Promise(resolver);
	}

	publishPacts(pacts, _s3Client_) {
		let self = this;

		if (!pacts) {
			throw new Error("No pacts array passed.")
		}

		//pacts.forEach(function(pact) {
		return this.getFilesFromPath(pacts[0])
			.then((files) => {
				return Promise.all(files.map(function (file) {
					return self.publishSinglePact(file, _s3Client_);
				}));
			})
			.catch((err) => {
				if (this.logger) {
					this.logger.error(`Error on BtrzPactS3::publishPacts()`, err);
				}
				throw err;
			});
	}

	verifyPacts(providerBaseUrl, providerName, _s3Client_, _pact_) {
		let self = this;
		const pact = _pact_ || require('@pact-foundation/pact-node');
		const s3Client = _s3Client_ || new AWS.S3({
			accessKeyId: this.accessKeyId,
			secretAccessKey: this.secretAccessKey
		});

		return s3Client.listObjects({Bucket: self.bucket}).promise()
			.then((data) => {
				let keysFromProvider = data.Contents.filter((content) => {
					return (content.Key.indexOf(`${providerName.toLowerCase()}/`) === 0);
				}).map((content) => {return content.Key});

				if (keysFromProvider.length === 0) {
					return reject(new Error(`There are no pacts for the provider ${providerName}`));
				}

				return Promise.all(keysFromProvider.map((key) => {
					return s3Client.getObject({Bucket: self.bucket, Key: key}).promise()
						.then((data) => {
							let filePath = `${__dirname}/pacts-to-verify/${path.basename(key)}`;
							fs.createWriteStream(filePath).write(data);
							return filePath;
						});
					})
				);
			})
			.then((filePaths) => {
				let opts = {
			    providerBaseUrl: providerBaseUrl,
			    pactUrls: filePaths
				};
				return pact.verifyPacts(opts);
			})
			.catch((err) => {
				if (this.logger) {
					this.logger.error(`Error on BtrzPactS3::verifyPacts()`, err);
				}
				throw err;
			});

		// function resolver(resolve, reject) {

		// 	s3Client.listObjects({Bucket: self.bucket}, (err, data) => {
		// 		if (err) {
		// 			if (self.logger) {
		// 				self.logger.error(`Error on BtrzPactS3::verifyPacts()`, err);
		// 			}
		// 			return reject(err);
		// 		}
				
		// 		let keysFromProvider = data.Contents.filter((content) => {
		// 			return (content.Key.indexOf(`${providerName.toLowerCase()}/`) === 0);
		// 		}).map((content) => {return content.Key});

		// 		if (keysFromProvider.length === 0) {
		// 			return reject(new Error(`There are no pacts for the provider ${providerName}`));
		// 		}

		// 		let pactFiles = [];
		// 		for (var i=0; i < keysFromProvider.length; i++) {
		// 			let filePath = `${__dirname}/pacts-to-verify/${path.basename(keysFromProvider[i])}`;
		// 			let file = fs.createWriteStream(filePath);
		// 			//s3Client.getObject({Bucket: self.bucket, Key: keysFromProvider[i]}).createReadStream().pipe(file);
		// 			s3Client.getObject({Bucket: self.bucket, Key: keysFromProvider[i]}).promise()
		// 				.then((data) => {
		// 					file.write(data);
		// 					pactFiles.push(filePath);
		// 				});
		// 		}
				
		// 		var opts = {
		// 	    providerBaseUrl: providerBaseUrl,
		// 	    pactUrls: pactFiles
		// 		};

		// 		pact.verifyPacts(opts)
		// 			.then((result) => {					
		// 		    return resolve(result);
		// 			})
		// 			.catch((err) => {
		// 				return reject(err);
		// 			});
		// 	});
		// }
		// return new Promise(resolver);
	}

	getFileKey(filePath) {

		function resolver(resolve, reject) {
			return fs.readFile(filePath, "utf8", function (err, data) {
				if (err) {
					return reject(err);
				}
				let fileName = path.basename(filePath);
				let pact = JSON.parse(data);

				if (!pact.consumer.name) {
					return reject(new Error(`The consumer name was not especified in the ${fileName} pact file`));
				}
				if (!pact.provider.name) {
					return reject(new Error(`The provider name was not especified in the ${fileName} pact file`));
				}

				return resolve(`${pact.provider.name.toLowerCase()}/${pact.consumer.name.toLowerCase()}/${fileName}`);
			});
		}
		return new Promise(resolver);
	}
}

exports.BtrzPactS3 = BtrzPactS3;