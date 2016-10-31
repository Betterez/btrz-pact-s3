# btrz-pact-s3
Pact publish and verify, serving files in AWS S3 and based in the Pact Foundation https://docs.pact.io

# Install
run `npm install btrz-pact-s3 --save`

# Using btrz-pact-s3
    let options = {
      accessKeyId: "your_s3_key",
      secretAccessKey: "your_s3_secret_key",
      bucket: "your_s3_bucket"
    }
    
    const BtrzPactS3 = require("btrz-pact-s3").BtrzPactS3,
      btrzPactS3 = new BtrzPactS3(options, logger);

The `logger` is optional, if you need to log errors and information. We recommend to use a logger service.

# Publishing pacts      
    btrzPactS3.publishPacts([`${__dirname}/pacts`])
      .then(() => {
        console.log("Pacts published with success!");
      })
      .catch((err) => {
        console.log("Error publishing pacts", err);
      });
You can use individual pact files in the array or just a path where they are.

# Test
`npm test`
