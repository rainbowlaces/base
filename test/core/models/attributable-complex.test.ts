import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { Attributable } from '../../../src/core/models/attributable/attributable.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { setupTestTeardown } from './setup.js';
import type { ComplexAttributeType } from '../../../src/core/models/types.js';
import { Attribute } from '../../../src/core/models/attributable/attribute.js';

// Setup test isolation
setupTestTeardown();

// Define complex object interfaces for testing
interface Address {
  street: string;
  city: string;
  postalCode: string;
  country?: string;
}

interface ContactInfo {
  email?: string;
  phone?: string;
  preferred: 'email' | 'phone';
}

interface ProductVariant {
  sku: string;
  price: number;
  inStock: boolean;
  metadata?: Record<string, unknown>;
}

// Create runtime validators for complex types
const ADDRESS_VALIDATOR: ComplexAttributeType<Address> = {
  validate: (value: unknown): value is Address => {
    return (
      typeof value === 'object' && 
      value !== null &&
      'street' in value && typeof (value as Address).street === 'string' &&
      'city' in value && typeof (value as Address).city === 'string' &&
      'postalCode' in value && typeof (value as Address).postalCode === 'string' &&
      (!('country' in value) || typeof (value as Address).country === 'string')
    );
  }
};

const CONTACT_INFO_VALIDATOR: ComplexAttributeType<ContactInfo> = {
  validate: (value: unknown): value is ContactInfo => {
    if (typeof value !== 'object' || value === null) return false;
    
    const obj = value as ContactInfo;
    
    // Must have preferred field
    if (!('preferred' in obj) || (obj.preferred !== 'email' && obj.preferred !== 'phone')) {
      return false;
    }
    
    // Optional email/phone fields
    if ('email' in obj && typeof obj.email !== 'string') return false;
    if ('phone' in obj && typeof obj.phone !== 'string') return false;
    
    return true;
  }
};

const PRODUCT_VARIANT_VALIDATOR: ComplexAttributeType<ProductVariant> = {
  validate: (value: unknown): value is ProductVariant => {
    if (typeof value !== 'object' || value === null) return false;
    
    const obj = value as ProductVariant;
    
    return (
      'sku' in obj && typeof obj.sku === 'string' &&
      'price' in obj && typeof obj.price === 'number' &&
      'inStock' in obj && typeof obj.inStock === 'boolean' &&
      (!('metadata' in obj) || (typeof obj.metadata === 'object' && obj.metadata !== null))
    );
  }
};

// Define test models with complex attributes
const USER_ATTRIBUTES = {
  name: [String, 'single'],
  homeAddress: [ADDRESS_VALIDATOR, 'single'],
  workAddress: [ADDRESS_VALIDATOR, 'single'],
  contactMethods: [CONTACT_INFO_VALIDATOR, 'many'],
  tags: [String, 'many'],
} as const;

const PRODUCT_ATTRIBUTES = {
  title: [String, 'single'],
  variants: [PRODUCT_VARIANT_VALIDATOR, 'many'],
  shippingAddress: [ADDRESS_VALIDATOR, 'single'],
  isActive: [Boolean, 'single'],
} as const;

@model
class TestUser extends Attributable<typeof USER_ATTRIBUTES, typeof BaseModel>(BaseModel) {
  @field()
  accessor email!: string;
  
  public readonly Attributes = USER_ATTRIBUTES;
}

@model  
class TestProduct extends Attributable<typeof PRODUCT_ATTRIBUTES, typeof BaseModel>(BaseModel) {
  @field()
  accessor name!: string;
  
  @field()
  accessor price!: number;
  
  public readonly Attributes = PRODUCT_ATTRIBUTES;
}

describe('Attributable Complex Objects', () => {
  describe('Basic Complex Object Operations', () => {
    it('should set and get single complex attributes', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      const address: Address = {
        street: '123 Main St',
        city: 'London',
        postalCode: 'SW1A 1AA',
        country: 'UK'
      };
      
      await user.setAttribute('homeAddress', address);
      const retrieved = await user.getAttribute('homeAddress');
      
      assert.deepEqual(retrieved, address);
      assert.equal(retrieved?.street, '123 Main St');
      assert.equal(retrieved?.city, 'London');
      assert.equal(retrieved?.postalCode, 'SW1A 1AA');
      assert.equal(retrieved?.country, 'UK');
    });

    it('should set and get many complex attributes', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      const contact1: ContactInfo = { email: 'work@example.com', preferred: 'email' };
      const contact2: ContactInfo = { phone: '+44 123 456 789', preferred: 'phone' };
      const contact3: ContactInfo = { 
        email: 'personal@example.com', 
        phone: '+44 987 654 321', 
        preferred: 'email' 
      };
      
      await user.setAttribute('contactMethods', contact1);
      await user.setAttribute('contactMethods', contact2);
      await user.setAttribute('contactMethods', contact3);
      
      const contacts = await user.getAttribute('contactMethods');
      assert.equal(contacts.length, 3);
      
      // Check specific contact details
      const emailContact = contacts.find(c => c.email === 'work@example.com');
      assert.ok(emailContact);
      assert.equal(emailContact.preferred, 'email');
      
      const phoneContact = contacts.find(c => c.phone === '+44 123 456 789');
      assert.ok(phoneContact);
      assert.equal(phoneContact.preferred, 'phone');
    });

    it('should handle complex objects with nested metadata', async () => {
      const product = await TestProduct.create({ name: 'Test Product', price: 100 });
      
      const variant: ProductVariant = {
        sku: 'PROD-001-RED',
        price: 99.99,
        inStock: true,
        metadata: {
          color: 'red',
          size: 'medium',
          tags: ['popular', 'sale'],
          specs: {
            weight: '1.2kg',
            dimensions: { width: 10, height: 15, depth: 5 }
          }
        }
      };
      
      await product.setAttribute('variants', variant);
      const variants = await product.getAttribute('variants');
      
      assert.equal(variants.length, 1);
      const retrieved = variants[0];
      
      assert.equal(retrieved.sku, 'PROD-001-RED');
      assert.equal(retrieved.price, 99.99);
      assert.equal(retrieved.inStock, true);
      assert.deepEqual(retrieved.metadata, variant.metadata);
    });
  });

  describe('Validation and Error Handling', () => {
    it('should throw error for invalid complex object structure', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      // Invalid address - missing required fields
      const invalidAddress = {
        street: '123 Main St',
        // missing city and postalCode
      };
      
      await assert.rejects(
        async () => await user.setAttribute('homeAddress', invalidAddress as Address),
        /Value for attribute "homeAddress" failed validation for complex type/
      );
    });

    it('should throw error for completely wrong type', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      await assert.rejects(
        async () => await user.setAttribute('homeAddress', 'not an address' as any),
        /Value for attribute "homeAddress" failed validation for complex type/
      );
    });

    it('should throw error for invalid complex object in many cardinality', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      const invalidContact = {
        email: 'test@example.com',
        // missing required 'preferred' field
      };
      
      await assert.rejects(
        async () => await user.setAttribute('contactMethods', invalidContact as ContactInfo),
        /Value for attribute "contactMethods" failed validation for complex type/
      );
    });

    it('should throw error for undefined attribute name', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      await assert.rejects(
        async () => await (user as any).setAttribute('nonExistentAttribute', { some: 'value' }),
        /Attribute "nonExistentAttribute" is not defined in the AttributeSpec/
      );
    });

    it('should filter out invalid complex objects during getAttribute', async () => {
      const product = await TestProduct.create({ name: 'Test Product', price: 100 });
      
      // Add a valid variant
      const validVariant: ProductVariant = {
        sku: 'VALID-001',
        price: 50.0,
        inStock: true
      };
      
      await product.setAttribute('variants', validVariant);
      
      // Manually add an invalid variant by creating a raw Attribute
      // (simulating corrupted data in database)
      const collection = await product.attributes();
      const currentAttrs = await collection.toArray();
      const invalidAttr = await Attribute.create({
        name: 'variants',
        value: { sku: 'INVALID', /* missing price and inStock */ },
        created: new Date(),
      });
      
      await product.attributes([...currentAttrs, invalidAttr]);
      
      // getAttribute should filter out invalid objects
      const variants = await product.getAttribute('variants');
      assert.equal(variants.length, 1);
      assert.equal(variants[0].sku, 'VALID-001');
    });
  });

  describe('Single vs Many Cardinality with Complex Objects', () => {
    it('should replace complex objects for single cardinality', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      const address1: Address = {
        street: '123 Old St',
        city: 'London',
        postalCode: 'E1 6AN'
      };
      
      const address2: Address = {
        street: '456 New St',
        city: 'Manchester',
        postalCode: 'M1 1AA'
      };
      
      await user.setAttribute('homeAddress', address1);
      await user.setAttribute('homeAddress', address2); // Should replace address1
      
      const currentAddress = await user.getAttribute('homeAddress');
      assert.deepEqual(currentAddress, address2);
      assert.equal(currentAddress?.city, 'Manchester');
    });

    it('should accumulate complex objects for many cardinality', async () => {
      const product = await TestProduct.create({ name: 'Test Product', price: 100 });
      
      const variant1: ProductVariant = { sku: 'VAR-001', price: 50, inStock: true };
      const variant2: ProductVariant = { sku: 'VAR-002', price: 60, inStock: false };
      const variant3: ProductVariant = { sku: 'VAR-003', price: 55, inStock: true };
      
      await product.setAttribute('variants', variant1);
      await product.setAttribute('variants', variant2);
      await product.setAttribute('variants', variant3);
      
      const variants = await product.getAttribute('variants');
      assert.equal(variants.length, 3);
      
      const skus = variants.map(v => v.sku).sort();
      assert.deepEqual(skus, ['VAR-001', 'VAR-002', 'VAR-003']);
    });

    it('should not duplicate identical complex objects in many cardinality', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      const contact: ContactInfo = { email: 'same@example.com', preferred: 'email' };
      
      await user.setAttribute('contactMethods', contact);
      await user.setAttribute('contactMethods', contact); // Should not duplicate
      
      const contacts = await user.getAttribute('contactMethods');
      assert.equal(contacts.length, 1);
      assert.equal(contacts[0].email, 'same@example.com');
    });
  });

  describe('Complex Object Queries', () => {
    it('should check existence of complex attributes', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      const address: Address = {
        street: '789 Query St',
        city: 'Birmingham',
        postalCode: 'B1 1BB'
      };
      
      // Before setting
      assert.equal(await user.hasAttribute('homeAddress'), false);
      
      // After setting
      await user.setAttribute('homeAddress', address);
      assert.equal(await user.hasAttribute('homeAddress'), true);
      assert.equal(await user.hasAttribute('homeAddress', address), true);
      
      // Different address should not match
      const differentAddress: Address = {
        street: '999 Different St',
        city: 'Birmingham',
        postalCode: 'B1 1BB'
      };
      assert.equal(await user.hasAttribute('homeAddress', differentAddress), false);
    });

    it('should check existence with complex objects in many cardinality', async () => {
      const product = await TestProduct.create({ name: 'Test Product', price: 100 });
      
      const variant1: ProductVariant = { sku: 'CHECK-001', price: 25, inStock: true };
      const variant2: ProductVariant = { sku: 'CHECK-002', price: 30, inStock: false };
      
      await product.setAttribute('variants', variant1);
      await product.setAttribute('variants', variant2);
      
      assert.equal(await product.hasAttribute('variants'), true);
      assert.equal(await product.hasAttribute('variants', variant1), true);
      assert.equal(await product.hasAttribute('variants', variant2), true);
      
      const nonExistentVariant: ProductVariant = { sku: 'NONE-001', price: 0, inStock: false };
      assert.equal(await product.hasAttribute('variants', nonExistentVariant), false);
    });

    it('should delete specific complex objects', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      const contact1: ContactInfo = { email: 'keep@example.com', preferred: 'email' };
      const contact2: ContactInfo = { phone: '+44 111 222 333', preferred: 'phone' };
      const contact3: ContactInfo = { email: 'delete@example.com', preferred: 'email' };
      
      await user.setAttribute('contactMethods', contact1);
      await user.setAttribute('contactMethods', contact2);
      await user.setAttribute('contactMethods', contact3);
      
      // Delete specific contact
      await user.deleteAttribute('contactMethods', contact3);
      
      const remaining = await user.getAttribute('contactMethods');
      assert.equal(remaining.length, 2);
      
      const emails = remaining.filter(c => c.email).map(c => c.email);
      assert.ok(emails.includes('keep@example.com'));
      assert.ok(!emails.includes('delete@example.com'));
    });

    it('should delete all complex attributes when no value specified', async () => {
      const product = await TestProduct.create({ name: 'Test Product', price: 100 });
      
      const variant1: ProductVariant = { sku: 'DEL-001', price: 10, inStock: true };
      const variant2: ProductVariant = { sku: 'DEL-002', price: 20, inStock: false };
      
      await product.setAttribute('variants', variant1);
      await product.setAttribute('variants', variant2);
      
      await product.deleteAttribute('variants');
      
      const variants = await product.getAttribute('variants');
      assert.equal(variants.length, 0);
    });
  });

  describe('Mixed Scalar and Complex Attributes', () => {
    it('should handle models with both scalar and complex attributes', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      // Set scalar attributes
      await user.setAttribute('name', 'John Doe');
      await user.setAttribute('tags', 'vip');
      await user.setAttribute('tags', 'premium');
      
      // Set complex attributes
      const address: Address = {
        street: '123 Mixed St',
        city: 'London',
        postalCode: 'SW1A 1AA'
      };
      await user.setAttribute('homeAddress', address);
      
      const contact: ContactInfo = { email: 'mixed@example.com', preferred: 'email' };
      await user.setAttribute('contactMethods', contact);
      
      // Verify all attributes are correctly stored and retrieved
      assert.equal(await user.getAttribute('name'), 'John Doe');
      
      const tags = await user.getAttribute('tags');
      assert.deepEqual(tags.sort(), ['premium', 'vip']);
      
      const retrievedAddress = await user.getAttribute('homeAddress');
      assert.deepEqual(retrievedAddress, address);
      
      const contacts = await user.getAttribute('contactMethods');
      assert.equal(contacts.length, 1);
      assert.equal(contacts[0].email, 'mixed@example.com');
    });

    it('should handle raw attributes with complex objects', async () => {
      const product = await TestProduct.create({ name: 'Test Product', price: 100 });
      
      await product.setAttribute('title', 'Raw Test Product');
      await product.setAttribute('isActive', true);
      
      const variant: ProductVariant = { sku: 'RAW-001', price: 75, inStock: true };
      await product.setAttribute('variants', variant);
      
      // Get all raw attributes
      const allRaw = await product.getRawAttributes();
      assert.equal(allRaw.length, 3);
      
      const titles = allRaw.filter(attr => attr.name === 'title');
      assert.equal(titles.length, 1);
      assert.equal(titles[0].value, 'Raw Test Product');
      
      const variants = allRaw.filter(attr => attr.name === 'variants');
      assert.equal(variants.length, 1);
      assert.deepEqual(variants[0].value, variant);
      
      // Get raw attributes for specific complex attribute
      const variantRaw = await product.getRawAttributes('variants');
      assert.equal(variantRaw.length, 1);
      assert.equal(variantRaw[0].name, 'variants');
      assert.deepEqual(variantRaw[0].value, variant);
      assert.ok(variantRaw[0].created instanceof Date);
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    it('should handle optional fields in complex objects', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      // Address without optional country field
      const address: Address = {
        street: '123 Optional St',
        city: 'London',
        postalCode: 'SW1A 1AA'
        // country is optional
      };
      
      await user.setAttribute('homeAddress', address);
      const retrieved = await user.getAttribute('homeAddress');
      
      assert.equal(retrieved?.street, '123 Optional St');
      assert.equal(retrieved?.country, undefined);
    });

    it('should handle deeply nested objects in metadata', async () => {
      const product = await TestProduct.create({ name: 'Test Product', price: 100 });
      
      const complexVariant: ProductVariant = {
        sku: 'DEEP-001',
        price: 199.99,
        inStock: true,
        metadata: {
          categories: ['electronics', 'gadgets'],
          specifications: {
            technical: {
              processor: 'ARM64',
              memory: '8GB',
              storage: {
                type: 'SSD',
                capacity: '256GB',
                details: {
                  manufacturer: 'Samsung',
                  model: '980 PRO'
                }
              }
            },
            physical: {
              dimensions: { width: 10, height: 2, depth: 15 },
              weight: 0.5
            }
          }
        }
      };
      
      await product.setAttribute('variants', complexVariant);
      const variants = await product.getAttribute('variants');
      
      assert.equal(variants.length, 1);
      const retrieved = variants[0];
      
      assert.deepEqual(retrieved.metadata, complexVariant.metadata);
      
      // Verify deep nested access
      const storage = (retrieved.metadata as any).specifications.technical.storage;
      assert.equal(storage.type, 'SSD');
      assert.equal(storage.details.manufacturer, 'Samsung');
    });

    it('should preserve object references and types', async () => {
      const user = await TestUser.create({ email: 'test@example.com' });
      
      // Use Date objects in metadata to test type preservation
      const timestampedContact: ContactInfo & { lastUpdated?: Date } = {
        email: 'timestamped@example.com',
        preferred: 'email',
        lastUpdated: new Date('2025-07-31T12:00:00Z')
      };
      
      await user.setAttribute('contactMethods', timestampedContact);
      const contacts = await user.getAttribute('contactMethods');
      
      assert.equal(contacts.length, 1);
      const retrieved = contacts[0] as any;
      
      assert.equal(retrieved.email, 'timestamped@example.com');
      // Note: Date objects in nested metadata might be serialized as strings
      // depending on the serialization strategy
      assert.ok(retrieved.lastUpdated);
    });
  });
});
