import { expect } from "chai";

import {
  kebabToUpperCamel,
  kebabToLowerCamel,
  camelToKebab,
  camelToLowerUnderscore,
  camelToUpperUnderscore,
  isUpperCamelCase,
  isLowerCamelCase,
  isLowerUnderscore,
  isUpperUnderscore,
  isKebabCase,
  truncate,
} from "../../utils/string";

describe("String Utility Functions", () => {
  describe("kebabToUpperCamel", () => {
    it("converts kebab-case to UpperCamelCase", () => {
      expect(kebabToUpperCamel("kebab-case-string")).to.equal(
        "KebabCaseString",
      );
      expect(kebabToUpperCamel("with_underscore")).to.equal("WithUnderscore");
      expect(kebabToUpperCamel("with spaces")).to.equal("WithSpaces");
    });
  });

  describe("kebabToLowerCamel", () => {
    it("converts kebab-case to lowerCamelCase", () => {
      expect(kebabToLowerCamel("kebab-case-string")).to.equal(
        "kebabCaseString",
      );
      expect(kebabToLowerCamel("with_underscore")).to.equal("withUnderscore");
      expect(kebabToLowerCamel("with spaces")).to.equal("withSpaces");
    });
  });

  describe("camelToKebab", () => {
    it("converts CamelCase to kebab-case", () => {
      expect(camelToKebab("CamelCaseString")).to.equal("camel-case-string");
      expect(camelToKebab("lowerCamelCase")).to.equal("lower-camel-case");
    });
  });

  describe("camelToLowerUnderscore", () => {
    it("converts CamelCase to lower_underscore", () => {
      expect(camelToLowerUnderscore("CamelCaseString")).to.equal(
        "camel_case_string",
      );
      expect(camelToLowerUnderscore("lowerCamelCase")).to.equal(
        "lower_camel_case",
      );
    });
  });

  describe("camelToUpperUnderscore", () => {
    it("converts CamelCase to UPPER_UNDERSCORE", () => {
      expect(camelToUpperUnderscore("CamelCaseString")).to.equal(
        "CAMEL_CASE_STRING",
      );
      expect(camelToUpperUnderscore("lowerCamelCase")).to.equal(
        "LOWER_CAMEL_CASE",
      );
    });
  });

  describe("Case Validation Functions", () => {
    describe("isUpperCamelCase", () => {
      it("checks if a string is UpperCamelCase", () => {
        expect(isUpperCamelCase("UpperCamelCase")).to.be.true;
        expect(isUpperCamelCase("notUpperCamel")).to.be.false;
      });
    });

    describe("isLowerCamelCase", () => {
      it("checks if a string is lowerCamelCase", () => {
        expect(isLowerCamelCase("lowerCamelCase")).to.be.true;
        expect(isLowerCamelCase("NotlowerCamel")).to.be.false;
      });
    });

    describe("isLowerUnderscore", () => {
      it("checks if a string is lower_underscore", () => {
        expect(isLowerUnderscore("lower_underscore")).to.be.true;
        expect(isLowerUnderscore("Not_lower_underscore")).to.be.false;
      });
    });

    describe("isUpperUnderscore", () => {
      it("checks if a string is UPPER_UNDERSCORE", () => {
        expect(isUpperUnderscore("UPPER_UNDERSCORE")).to.be.true;
        expect(isUpperUnderscore("Not_UPPER_UNDERSCORE")).to.be.false;
      });
    });

    describe("isKebabCase", () => {
      it("checks if a string is kebab-case", () => {
        expect(isKebabCase("kebab-case")).to.be.true;
        expect(isKebabCase("Not-kebab-case")).to.be.false;
      });
    });

    describe("truncate", () => {
      it("truncates a string longer than the specified length and appends [TRUNCATED]", () => {
        const longString = "This is a very long string";
        expect(truncate(longString, 25)).to.equal("This is a very[TRUNCATED]");
      });

      it("returns the original string if it is shorter than the specified length", () => {
        const shortString = "Short string";
        expect(truncate(shortString, 25)).to.equal(shortString);
      });

      it("returns the original string if it is exactly the specified length", () => {
        const exactLengthString = "Exactly 25 characters!!!!";
        expect(truncate(exactLengthString, 25)).to.equal(exactLengthString);
      });

      it("handles empty strings correctly", () => {
        expect(truncate("", 10)).to.equal("");
      });

      it("does not append when appendToEnd is longer than the specified length", () => {
        expect(truncate("Some text", 5)).to.equal("Some ");
      });

      it("allows custom appendToEnd strings", () => {
        const longString = "Another long string that will be cut";
        expect(truncate(longString, 10, "...")).to.equal("Another...");
      });
    });
  });
});
