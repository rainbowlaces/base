import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { Attributable } from '../../../src/core/models/attributable/attributable.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { setupTestTeardown } from './setup.js';
import type { ComplexAttributeType } from '../../../src/core/models/types.js';

// Setup test isolation
setupTestTeardown();

// Define interfaces for type testing
interface Address {
  street: string;
  city: string;
  postalCode: string;
  country?: string;
}

interface UserProfile {
  displayName: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}

// Create validators
const ADDRESS_VALIDATOR: ComplexAttributeType<Address> = {
  validate: (value: unknown): value is Address => {
    return (
      typeof value === 'object' && 
      value !== null &&
      'street' in value && typeof (value as Address).street === 'string' &&
      'city' in value && typeof (value as Address).city === 'string' &&
      'postalCode' in value && typeof (value as Address).postalCode === 'string'
    );
  }
};

const USER_PROFILE_VALIDATOR: ComplexAttributeType<UserProfile> = {
  validate: (value: unknown): value is UserProfile => {
    if (typeof value !== 'object' || value === null) return false;
    
    const obj = value as UserProfile;
    
    return (
      'displayName' in obj && typeof obj.displayName === 'string' &&
      'preferences' in obj && typeof obj.preferences === 'object' &&
      obj.preferences !== null &&
      'theme' in obj.preferences && 
      (obj.preferences.theme === 'light' || obj.preferences.theme === 'dark') &&
      'notifications' in obj.preferences && 
      typeof obj.preferences.notifications === 'boolean'
    );
  }
};

// Define comprehensive attribute spec for type testing
const TYPED_USER_ATTRIBUTES = {
  // Scalar single attributes
  name: [String, 'single'],
  age: [Number, 'single'],
  isActive: [Boolean, 'single'],
  birthDate: [Date, 'single'],
  userId: [UniqueID, 'single'],
  
  // Scalar many attributes
  tags: [String, 'many'],
  scores: [Number, 'many'],
  flags: [Boolean, 'many'],
  importantDates: [Date, 'many'],
  relatedUsers: [UniqueID, 'many'],
  
  // Complex single attributes
  homeAddress: [ADDRESS_VALIDATOR, 'single'],
  profile: [USER_PROFILE_VALIDATOR, 'single'],
  
  // Complex many attributes
  addresses: [ADDRESS_VALIDATOR, 'many'],
  profiles: [USER_PROFILE_VALIDATOR, 'many'],
} as const;

@model
class TypedTestUser extends Attributable<typeof TYPED_USER_ATTRIBUTES, typeof BaseModel>(BaseModel) {
  @field()
  accessor email!: string;
  
  public readonly Attributes = TYPED_USER_ATTRIBUTES;
}

describe('Attributable Type Safety and Inference', () => {
  describe('Scalar Type Inference', () => {
    it('should correctly infer single scalar attribute types', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // Test string
      await user.setAttribute('name', 'John Doe');
      const name = await user.getAttribute('name');
      // TypeScript should infer: string | undefined
      if (name) {
        assert.equal(typeof name, 'string');
        assert.equal(name.length, 8); // Should have string methods
      }
      
      // Test number
      await user.setAttribute('age', 25);
      const age = await user.getAttribute('age');
      // TypeScript should infer: number | undefined
      if (age) {
        assert.equal(typeof age, 'number');
        assert.equal(age + 1, 26); // Should work with arithmetic
      }
      
      // Test boolean
      await user.setAttribute('isActive', true);
      const isActive = await user.getAttribute('isActive');
      // TypeScript should infer: boolean | undefined
      if (isActive !== undefined) {
        assert.equal(typeof isActive, 'boolean');
        assert.equal(!isActive, false); // Should work with boolean ops
      }
      
      // Test Date
      const birthDate = new Date('1990-01-01');
      await user.setAttribute('birthDate', birthDate);
      const retrievedDate = await user.getAttribute('birthDate');
      // TypeScript should infer: Date | undefined
      if (retrievedDate) {
        assert.ok(retrievedDate instanceof Date);
        assert.equal(retrievedDate.getFullYear(), 1990); // Should have Date methods
      }
      
      // Test UniqueID
      const userId = new UniqueID();
      await user.setAttribute('userId', userId);
      const retrievedUserId = await user.getAttribute('userId');
      // TypeScript should infer: UniqueID | undefined
      if (retrievedUserId) {
        assert.ok(retrievedUserId instanceof UniqueID);
        assert.ok(retrievedUserId.equals(userId)); // Should have UniqueID methods
      }
    });

    it('should correctly infer many scalar attribute types', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // Test string array
      await user.setAttribute('tags', 'tag1');
      await user.setAttribute('tags', 'tag2');
      const tags = await user.getAttribute('tags');
      // TypeScript should infer: string[]
      assert.ok(Array.isArray(tags));
      assert.equal(tags.length, 2);
      tags.forEach(tag => {
        assert.equal(typeof tag, 'string');
        assert.ok(tag.toUpperCase); // Should have string methods
      });
      
      // Test number array
      await user.setAttribute('scores', 85);
      await user.setAttribute('scores', 92);
      const scores = await user.getAttribute('scores');
      // TypeScript should infer: number[]
      assert.ok(Array.isArray(scores));
      const total = scores.reduce((sum, score) => sum + score, 0); // Should work with arithmetic
      assert.equal(total, 177);
      
      // Test boolean array
      await user.setAttribute('flags', true);
      await user.setAttribute('flags', false);
      const flags = await user.getAttribute('flags');
      // TypeScript should infer: boolean[]
      assert.ok(Array.isArray(flags));
      const hasTrue = flags.some(flag => flag === true); // Should work with boolean logic
      assert.equal(hasTrue, true);
      
      // Test Date array
      const date1 = new Date('2025-01-01');
      const date2 = new Date('2025-12-31');
      await user.setAttribute('importantDates', date1);
      await user.setAttribute('importantDates', date2);
      const dates = await user.getAttribute('importantDates');
      // TypeScript should infer: Date[]
      assert.ok(Array.isArray(dates));
      dates.forEach(date => {
        assert.ok(date instanceof Date);
        assert.ok(date.getTime); // Should have Date methods
      });
      
      // Test UniqueID array
      const id1 = new UniqueID();
      const id2 = new UniqueID();
      await user.setAttribute('relatedUsers', id1);
      await user.setAttribute('relatedUsers', id2);
      const ids = await user.getAttribute('relatedUsers');
      // TypeScript should infer: UniqueID[]
      assert.ok(Array.isArray(ids));
      ids.forEach(id => {
        assert.ok(id instanceof UniqueID);
        assert.ok(id.toString); // Should have UniqueID methods
      });
    });
  });

  describe('Complex Object Type Inference', () => {
    it('should correctly infer single complex attribute types', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // Test Address type
      const address: Address = {
        street: '123 Type St',
        city: 'London',
        postalCode: 'SW1A 1AA',
        country: 'UK'
      };
      
      await user.setAttribute('homeAddress', address);
      const retrievedAddress = await user.getAttribute('homeAddress');
      // TypeScript should infer: Address | undefined
      if (retrievedAddress) {
        assert.equal(typeof retrievedAddress.street, 'string');
        assert.equal(typeof retrievedAddress.city, 'string');
        assert.equal(typeof retrievedAddress.postalCode, 'string');
        assert.equal(retrievedAddress.street.toUpperCase(), '123 TYPE ST'); // Should have string methods
        
        // Optional field should work
        if (retrievedAddress.country) {
          assert.equal(typeof retrievedAddress.country, 'string');
        }
      }
      
      // Test UserProfile type
      const profile: UserProfile = {
        displayName: 'John Doe',
        avatar: 'avatar.jpg',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };
      
      await user.setAttribute('profile', profile);
      const retrievedProfile = await user.getAttribute('profile');
      // TypeScript should infer: UserProfile | undefined
      if (retrievedProfile) {
        assert.equal(typeof retrievedProfile.displayName, 'string');
        assert.equal(retrievedProfile.preferences.theme, 'dark');
        assert.equal(typeof retrievedProfile.preferences.notifications, 'boolean');
        
        // Should be able to access nested properties
        const validThemes: Array<'light' | 'dark'> = ['light', 'dark'];
        const themeIsValid = validThemes.includes(retrievedProfile.preferences.theme);
        assert.equal(themeIsValid, true);
        assert.equal(retrievedProfile.preferences.theme, 'dark'); // We set it to 'dark'
      }
    });

    it('should correctly infer many complex attribute types', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // Test Address array
      const address1: Address = { street: '123 First St', city: 'London', postalCode: 'E1 6AN' };
      const address2: Address = { street: '456 Second St', city: 'Manchester', postalCode: 'M1 1AA' };
      
      await user.setAttribute('addresses', address1);
      await user.setAttribute('addresses', address2);
      const addresses = await user.getAttribute('addresses');
      // TypeScript should infer: Address[]
      assert.ok(Array.isArray(addresses));
      assert.equal(addresses.length, 2);
      
      addresses.forEach(addr => {
        assert.equal(typeof addr.street, 'string');
        assert.equal(typeof addr.city, 'string');
        assert.equal(typeof addr.postalCode, 'string');
      });
      
      const londonAddress = addresses.find(addr => addr.city === 'London');
      assert.ok(londonAddress);
      assert.equal(londonAddress.street, '123 First St');
      
      // Test UserProfile array
      const profile1: UserProfile = {
        displayName: 'Profile 1',
        preferences: { theme: 'light', notifications: true }
      };
      const profile2: UserProfile = {
        displayName: 'Profile 2',
        preferences: { theme: 'dark', notifications: false }
      };
      
      await user.setAttribute('profiles', profile1);
      await user.setAttribute('profiles', profile2);
      const profiles = await user.getAttribute('profiles');
      // TypeScript should infer: UserProfile[]
      assert.ok(Array.isArray(profiles));
      assert.equal(profiles.length, 2);
      
      const darkProfile = profiles.find(p => p.preferences.theme === 'dark');
      assert.ok(darkProfile);
      assert.equal(darkProfile.displayName, 'Profile 2');
      assert.equal(darkProfile.preferences.notifications, false);
    });
  });

  describe('Query Method Type Safety', () => {
    it('should provide correct types for hasAttribute method', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // hasAttribute with scalar values
      await user.setAttribute('name', 'John');
      const hasName = await user.hasAttribute('name');
      assert.equal(typeof hasName, 'boolean');
      
      const hasSpecificName = await user.hasAttribute('name', 'John');
      assert.equal(typeof hasSpecificName, 'boolean');
      assert.equal(hasSpecificName, true);
      
      // hasAttribute with complex objects
      const address: Address = { street: '123 Test St', city: 'London', postalCode: 'E1 6AN' };
      await user.setAttribute('homeAddress', address);
      
      const hasAddress = await user.hasAttribute('homeAddress');
      assert.equal(typeof hasAddress, 'boolean');
      assert.equal(hasAddress, true);
      
      const hasSpecificAddress = await user.hasAttribute('homeAddress', address);
      assert.equal(typeof hasSpecificAddress, 'boolean');
      assert.equal(hasSpecificAddress, true);
    });

    it('should provide correct types for deleteAttribute method', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // Delete scalar attributes
      await user.setAttribute('tags', 'tag1');
      await user.setAttribute('tags', 'tag2');
      
      // Delete all tags
      await user.deleteAttribute('tags');
      const tagsAfterDelete = await user.getAttribute('tags');
      assert.equal(tagsAfterDelete.length, 0);
      
      // Delete specific tag
      await user.setAttribute('tags', 'keep');
      await user.setAttribute('tags', 'delete');
      await user.deleteAttribute('tags', 'delete');
      const remainingTags = await user.getAttribute('tags');
      assert.equal(remainingTags.length, 1);
      assert.equal(remainingTags[0], 'keep');
      
      // Delete complex attributes
      const address1: Address = { street: '123 Keep St', city: 'London', postalCode: 'E1 6AN' };
      const address2: Address = { street: '456 Delete St', city: 'London', postalCode: 'E2 7BB' };
      
      await user.setAttribute('addresses', address1);
      await user.setAttribute('addresses', address2);
      await user.deleteAttribute('addresses', address2);
      
      const remainingAddresses = await user.getAttribute('addresses');
      assert.equal(remainingAddresses.length, 1);
      assert.equal(remainingAddresses[0].street, '123 Keep St');
    });

    it('should provide correct types for getRawAttributes method', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      await user.setAttribute('name', 'John');
      await user.setAttribute('tags', 'tag1');
      await user.setAttribute('tags', 'tag2');
      
      const address: Address = { street: '123 Raw St', city: 'London', postalCode: 'E1 6AN' };
      await user.setAttribute('homeAddress', address);
      
      // Get all raw attributes
      const allRaw = await user.getRawAttributes();
      assert.ok(Array.isArray(allRaw));
      allRaw.forEach(attr => {
        assert.equal(typeof attr.name, 'string');
        assert.ok(attr.created instanceof Date);
        // attr.value should be of correct type but we can't type-check it statically
      });
      
      // Get raw attributes for specific name
      const nameRaw = await user.getRawAttributes('name');
      assert.ok(Array.isArray(nameRaw));
      assert.equal(nameRaw.length, 1);
      assert.equal(nameRaw[0].name, 'name');
      assert.equal(nameRaw[0].value, 'John');
      
      const addressRaw = await user.getRawAttributes('homeAddress');
      assert.ok(Array.isArray(addressRaw));
      assert.equal(addressRaw.length, 1);
      assert.equal(addressRaw[0].name, 'homeAddress');
      assert.deepEqual(addressRaw[0].value, address);
    });
  });

  describe('Type Safety Edge Cases', () => {
    it('should handle undefined and null values correctly', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // Single attributes should return undefined when not set
      const unsetName = await user.getAttribute('name');
      assert.equal(unsetName, undefined);
      
      const unsetAddress = await user.getAttribute('homeAddress');
      assert.equal(unsetAddress, undefined);
      
      // Many attributes should return empty array when not set
      const unsetTags = await user.getAttribute('tags');
      assert.ok(Array.isArray(unsetTags));
      assert.equal(unsetTags.length, 0);
      
      const unsetAddresses = await user.getAttribute('addresses');
      assert.ok(Array.isArray(unsetAddresses));
      assert.equal(unsetAddresses.length, 0);
    });

    it('should handle mixed scalar and complex attributes', async () => {
      const user = await TypedTestUser.create({ email: 'test@example.com' });
      
      // Set mix of attributes
      await user.setAttribute('name', 'Mixed Test');
      await user.setAttribute('age', 30);
      await user.setAttribute('tags', 'mixed');
      await user.setAttribute('tags', 'test');
      
      const address: Address = { street: '123 Mixed St', city: 'London', postalCode: 'E1 6AN' };
      await user.setAttribute('homeAddress', address);
      
      const profile: UserProfile = {
        displayName: 'Mixed User',
        preferences: { theme: 'light', notifications: true }
      };
      await user.setAttribute('profile', profile);
      
      // Verify all types are correct
      const name = await user.getAttribute('name');
      assert.equal(typeof name, 'string');
      
      const age = await user.getAttribute('age');
      assert.equal(typeof age, 'number');
      
      const tags = await user.getAttribute('tags');
      assert.ok(Array.isArray(tags));
      assert.equal(tags.length, 2);
      
      const retrievedAddress = await user.getAttribute('homeAddress');
      assert.ok(retrievedAddress);
      assert.equal(typeof retrievedAddress.street, 'string');
      
      const retrievedProfile = await user.getAttribute('profile');
      assert.ok(retrievedProfile);
      assert.equal(typeof retrievedProfile.displayName, 'string');
      assert.equal(retrievedProfile.preferences.theme, 'light');
    });
  });
});
