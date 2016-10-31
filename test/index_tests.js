"use strict";

describe("BtrzPactS3", function () {

  const BtrzPactS3 = require("../").BtrzPactS3,
    expect = require("chai").expect,
    Logger = require("btrz-logger").Logger,
    ConsoleLogger = require("btrz-logger").ConsoleLogger,
    Chance = require("chance").Chance,
    chance = new Chance(),
    AWS = require("aws-sdk"),
    request = require("request-promise"),
    sinon = require("sinon");
  let logger = new Logger(),
    btrzPactS3, options, s3Client;

  this.timeout(100000);

  before(() => {
    let consoleLogger = new ConsoleLogger();
    logger.addLogger(consoleLogger);
    options = {
      accessKeyId: chance.hash(),
      secretAccessKey: chance.hash(),
      bucket: "the-pact-bucket"
    };
    s3Client = new AWS.S3({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    });
  	btrzPactS3 = new BtrzPactS3(options, logger);
  });

  describe("constructor", () => {
    it("should throw if no options passed", () => {
      function sut() {
        new BtrzPactS3();  
      }
      expect(sut).to.throw("BtrzPactS3 options are mandatory.");
    });

    it("should throw if options.accessKeyId is not passed", () => {
      function sut() {
        new BtrzPactS3({});  
      }
      expect(sut).to.throw("BtrzPactS3 options.accessKeyId is mandatory.");
    });

    it("should throw if options.secretAccessKey is not passed", () => {
      function sut() {
        new BtrzPactS3({accessKeyId:chance.hash()});  
      }
      expect(sut).to.throw("BtrzPactS3 options.secretAccessKey is mandatory.");
    });

    it("should throw if options.bucket is not passed", () => {
      function sut() {
        new BtrzPactS3({accessKeyId:chance.hash(), secretAccessKey: chance.hash()});  
      }
      expect(sut).to.throw("BtrzPactS3 options.bucket is mandatory.");
    });

    it("should throw if logger is not valid", () => {
      function sut() {
        new BtrzPactS3({accessKeyId:chance.hash(), secretAccessKey: chance.hash(), bucket: chance.word()}, {});  
      }
      expect(sut).to.throw("BtrzPactS3 logger is not valid.");
    });

    it("should save the correct properties", () => {
      expect(btrzPactS3.accessKeyId).to.be.eql(options.accessKeyId);
      expect(btrzPactS3.secretAccessKey).to.be.eql(options.secretAccessKey);
      expect(btrzPactS3.bucket).to.be.eql(options.bucket);
      expect(btrzPactS3.logger).to.be.eql(logger);
    });
  });

  describe("publishPacts", function () {

    it("should throw an error if no pacts passed", function () {
    	function sut() {
    		btrzPactS3.publishPacts();
  		}
  		expect(sut).to.throw("No pacts array passed.");
    });

    it("should return error if the passed pact is not a file", function (done) {
    	btrzPactS3.publishPacts([`${__dirname}/pacts/not-existent-pact.json`])
    		.catch((err) => {
          expect(err).to.be.ok;
    			done();
    		});
    });

    it("should publish the pact in the S3", function (done) {
      sinon.stub(s3Client, "putObject", (opts, cb) => {
        expect(opts.Bucket).to.be.eql(options.bucket);
        expect(opts.Key).to.be.eql("soup/baby/baby-soup.json");
        expect(opts.ACL).to.be.eql("public-read");
        expect(opts.Body).to.respondTo("read");
        s3Client.putObject.restore();
        cb(null,{});
      });

      btrzPactS3.publishPacts([`${__dirname}/pacts/baby-soup.json`], s3Client)
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

    it.skip("should publish a folder of pacts in the S3", function (done) {
      let putObjectStub = sinon.stub(s3Client, "putObject");

      putObjectStub.onCall(0).returns(function (opts, cb) {
        expect(opts.Bucket).to.be.eql(options.bucket);
        expect(opts.Key).to.be.eql("song/baby/baby-song.json");
        expect(opts.ACL).to.be.eql("public-read");
        expect(opts.Body).to.respondTo("read");
        return cb(null,{});
      });

      putObjectStub.onCall(1).returns(function (opts, cb) {
        expect(opts.Bucket).to.be.eql(options.bucket);
        expect(opts.Key).to.be.eql("fruit/bird/bird-fruit.json");
        expect(opts.ACL).to.be.eql("public-read");
        expect(opts.Body).to.respondTo("read");
        return cb(null,{});
      });

      putObjectStub.returns(function (opts, cb) {
        expect(opts.Bucket).to.be.eql(options.bucket);
        expect(opts.Key).to.be.eql("seed/bird/bird-seed.json");
        expect(opts.ACL).to.be.eql("public-read");
        expect(opts.Body).to.respondTo("read");
        s3Client.putObject.restore();
        return cb(null,{});
      });

      btrzPactS3.publishPacts([`${__dirname}/pacts/another-api`], s3Client)
        .then(() => {
          done();
        })
        .catch((err) => {
          done(err);
        });
    });

  });

  describe("getFileKey", function () {
  	
  	it("should return the key based on the pact file", function (done) {
  		btrzPactS3.getFileKey(`${__dirname}/pacts/baby-soup.json`)
  			.then((key) => {
  				expect(key).to.be.eql("soup/baby/baby-soup.json");
  				done();
  			})
  			.catch((err) => {done(err);});
  	});

    it("should return the key based on the pact file", function (done) {
      btrzPactS3.getFileKey(`${__dirname}/not-existent.file`)
        .catch((err) => {
          expect(err).to.be.ok;
          done();
        });
    });

  });

});