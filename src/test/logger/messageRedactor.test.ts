import { expect } from "chai";
import LogMessageRedactorDefault from "../../logger/logMessageRedactor";

function testPattern(
  redactor: LogMessageRedactorDefault,
  name: string,
  testData: string[],
) {
  const message = {
    timestamp: "NOW",
    level: "DEBUG",
    message: "",
    namespace: "test",
    tags: ["tag"],
    context: {
      data: {},
      meta: {
        itemsTruncated: false,
        stringTruncated: false,
        circularRefs: false,
      },
    },
  };

  testData.forEach((testData) => {
    message.message = `${name}: ${testData}`;
    message.context.data = { [name]: testData };
    const redacted = redactor.redact(message);
    redacted.message = redacted.message = `${redacted.message} (${testData})`;
    expect(redacted.message).to.equal(`${name}: [${name}] (${testData})`);
    expect(redacted.context.data).to.deep.equal({ [name]: `[${name}]` });
  });
}

describe("LogMessageRedactorDefault", () => {
  let redactor: LogMessageRedactorDefault;

  beforeEach(() => {
    redactor = new LogMessageRedactorDefault();
  });

  describe("when initialized with defaults", () => {
    beforeEach(() => {
      redactor.init({});
    });

    it("should redact an email address from the message", () => {
      testPattern(redactor, "email", [
        "test.email+alex@domain.co.uk",
        "valid_email123@domain.com",
        "user.name@example.org",
        "email.test+ruby@another-domain.io",
        "valid-email@sub.domain.com",
        "test_user@valid.co.in",
        "example+test@domain.academy",
        "fake.email@domain-service.com",
        "primary.test+1234@domain.info",
        "user-example@domain.tech",
        "some@email.com",
      ]);
    });

    it("should redact a phone number from the message", () => {
      testPattern(redactor, "phone_number", [
        "+44 (0) 321 2212", // UK, space separator
        "+44 234 5678 33", // UK, space separator
        "+1-555-234-5678", // US, dash separator
        "+86.21.1234.5678", // China, dot separator
        "00 33 1 23 45 67 89", // France, space separator
        "00-49-30-12345678", // Germany, dash separator
        "00.39.02.1234.5678", // Italy, dot separator
        "0 20 1234 5678", // UK local, space separator
        "0-800-123-4567", // UK Freephone, dash separator
        "0.800.123.4567", // Alternate format, dot separator
        "+61 2 1234 5678", // Australia, space separator
        "+27-21-123-4567", // South Africa, dash separator
        "+81.3.1234.5678", // Japan, dot separator
        "00 7 495 123 45 67", // Russia, space separator
        "0 30 12345678", // Local DE, space separator
        "+34-91-123-45-67", // Spain, dash separator
        "+442012345678", // UK, no separator
        "+15552345678", // US, no separator
        "+862112345678", // China, no separator
        "0033123456789", // France, no separator
        "00493012345678", // Germany, no separator
        "00390212345678", // Italy, no separator
        "02012345678", // UK local, no separator
        "08001234567", // UK Freephone, no separator
        "0612345678", // Australia local, no separator
        "+61212345678", // Australia, no separator
        "+27211234567", // South Africa, no separator
        "+81312345678", // Japan, no separator
        "0074951234567", // Russia, no separator
        "03012345678", // Local DE, no separator
        "+34911234567", // Spain, no separator
      ]);
    });

    it("should redact a SSN from the message", () => {
      testPattern(redactor, "ssn", [
        "123-45-6789", // With dashes
        "234-56-7891", // With dashes
        "456 78 9123", // With spaces
        "321 65 4987", // With spaces
        "234567890", // No separators
        "765432189", // No separators
        "123 45 6789", // With spaces
        "234 56 7891", // With spaces
        "456-78-9123", // With dashes
        "321-65-4987", // With dashes
      ]);
    });

    it("should redact a credit card number from the message", () => {
      testPattern(redactor, "credit_card", [
        "387758886457984",
        "3895 407928 79234",
        "3871-874325-49224",
        "3853.365498.37974",
        "38775888645793",
        "3895 407925 7923",
        "3895-407925-7923",
        "3853.365498.3797",
        "3734524717647894",
        "3734 5247 1764 7894",
        "3734-5247-1764-7894",
        "3734.5247.1764.7894",
        "4590-9329-6255-4607",
        "37345247176478941",
        "373452471764789412",
        "3734524717647894123",
        "3734 5247 1764 7894 1",
        "3734-5247-1764-7894-1",
        "3734.5247.1764.7894.1",
        "3734 5247 1764 7894 12",
        "3734-5247-1764-7894-12",
        "3734.5247.1764.7894.12",
        "3734 5247 1764 7894 123",
        "3734-5247-1764-7894-123",
        "3734.5247.1764.7894.123",
      ]);
    });

    it("should redact an IPv4 address from the message", () => {
      testPattern(redactor, "ip4_address", [
        "42.200.129.163",
        "244.230.115.183",
        "198.76.151.43",
        "79.167.228.244",
        "35.247.13.240",
        "171.2.146.135",
        "42.43.51.146",
        "198.57.225.54",
        "118.255.168.245",
        "242.90.226.220",
      ]);
    });

    it("should redact an IPv6 address from the message", () => {
      testPattern(redactor, "ip6_address", [
        "1cbb:bafe:5c04:1507:8d09:65d0:1b1c:54ef",
        "1085:c6a7:9204:3489:5568:2740:dd51:ee75",
        "d68:a10e:2e3a:7c46:91c1:6cfc:d5cc:636c",
        "cf00:6e7d:62ab:f799:ee25:14c:d105:4ce8",
        "47cf:fa54:724f:22a3:1fd8:abbf:176b:dd77",
        "b4e0:c039:da19:fc6:a133:ee1:97a5:7a1e",
        "eb30:bdb7:8594:ec00:5b01:a3ac:9b40:8041",
        "e901:3e08:87e4:f8c7:5e79:a321:18c9:b593",
        "fe3c:3627:c393:2b23:3df1:7462:a2b1:bd74",
        "3210:9b44:c6d9:647d:e310:1ffc:548a:1fce",
      ]);
    });

    it("should redact NI numbers from the message", () => {
      testPattern(redactor, "ni_number", [
        "YE946228W",
        "RY008425A",
        "NZ607401R",
        "HW055251B",
        "XX802129Y",
        "YE 94 62 28W",
        "RY 00 84 25A",
        "NZ 60 74 01R",
        "HW 05 52 51B",
        "XX 80 21 29Y",
        "YE-94-62-28W",
        "RY-00-84-25A",
        "NZ-60-74-01R",
        "HW-05-52-51B",
        "XX-80-21-29Y",
      ]);
    });

    it("should redact UK post codes from the message", () => {
      testPattern(redactor, "uk_post_code", [
        "M6 7CK",
        "BFPO 400",
        "W8 0QE",
        "N12 9UE",
        "BX5 1LE",
        "B20 1UV",
        "N16 6OL",
        "S11 4QS",
        "M11 9YD",
        "BX2 1LB",
        "M9 7DQ",
        "L17 7BG",
        "E3 9JB",
        "G19 3TL",
        "BX3 2BB",
        "XX50 5BB",
        "N5 2ZP",
        "E10 7OS",
        "XX20 2ZZ",
        "BX4 2BZ",
        "M20 9YX",
        "BX1 1LT",
        "M2 3QS",
        "N16 2KY",
        "WC12 5LX",
        "E20 3IA",
        "L7 8PK",
        "B4 4NM",
        "S8 1OC",
        "W3 8XI",
        "W18 5HJ",
        "BFPO 801",
        "BFPO 61",
        "XX10 1DD",
        "S8 0BM",
        "G14 7ES",
        "N19 4RY",
        "G11 6FF",
        "E17 6YX",
        "S3 1PP",
        "E4 4IT",
        "G18 0RY",
        "XX40 4AA",
        "E12 7LY",
        "XX30 3QQ",
        "L5 9AS",
        "GIR 0AA",
        "WC8 7WC",
        "S2 2WG",
      ]);
    });

    it("should redact US zip codes from the message", () => {
      testPattern(redactor, "zip_code", [
        "80144",
        "89791",
        "57676",
        "77799",
        "37470",
        "79107",
        "52531",
        "22848",
        "67981",
        "48664",
        "22972-9111",
        "52917-5872",
        "87046-9062",
        "57685-8848",
        "33706-4583",
        "16373-7769",
        "70502-1462",
        "14919-7535",
        "57186-6874",
        "78611-2054",
      ]);
    });
  });

  describe("when initialized with a custom pattern", () => {
    beforeEach(() => {
      redactor.init({
        patterns: {
          custom: /test/,
        },
      });
    });

    it("should redact the custom pattern from the message", () => {
      testPattern(redactor, "custom", ["test"]);
    });
  });
});
