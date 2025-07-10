import { BaseTemplate } from "../../../src/modules/templates/baseTemplate";
import { template } from "../../../src/modules/templates/decorators/template";
import { html } from "../../../src/modules/templates/engine/html";
import { type TemplateResult } from "../../../src/modules/templates/engine/templateResult";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  tags: string[];
  createdAt: Date;
}

interface ProductListTemplateData {
  products: Product[];
  categories: string[];
  config: {
    maxProductsPerPage: number;
    allowDiscounts: boolean;
    defaultCategory: string;
    priceDisplayCurrency: string;
  };
  filters?: {
    category?: string;
    inStock?: string;
    search?: string;
  };
}

@template()
export class ProductListTemplate extends BaseTemplate<ProductListTemplateData> {
  public render(): TemplateResult {
    return html`
<!DOCTYPE html>
<html>
<head>
    <title>Product Catalog</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { margin-bottom: 20px; }
        .filters { background: #f9f9f9; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .filters input, .filters select { margin: 5px; padding: 5px; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .product-card { 
            border: 1px solid #ddd; 
            padding: 15px; 
            border-radius: 5px; 
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .product-card h3 { margin: 0 0 10px 0; color: #333; }
        .product-card .price { font-size: 18px; font-weight: bold; color: #2c5aa0; }
        .product-card .category { 
            background: #e0e0e0; 
            padding: 2px 8px; 
            border-radius: 3px; 
            font-size: 12px; 
            display: inline-block;
            margin: 5px 0;
        }
        .product-card .tags { margin: 5px 0; }
        .product-card .tag { 
            background: #f0f0f0; 
            padding: 2px 6px; 
            border-radius: 3px; 
            font-size: 11px; 
            margin-right: 5px;
        }
        .stock-status { 
            padding: 2px 8px; 
            border-radius: 3px; 
            font-size: 12px; 
            font-weight: bold;
        }
        .in-stock { background: #d4edda; color: #155724; }
        .out-of-stock { background: #f8d7da; color: #721c24; }
        .stats { background: #e9ecef; padding: 10px; margin-bottom: 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Product Catalog</h1>
        <div class="stats">
            <p>Showing ${this.data.products.length} products</p>
            <p>Currency: ${this.data.config.priceDisplayCurrency}</p>
            <p>Max per page: ${this.data.config.maxProductsPerPage}</p>
        </div>
    </div>
    
    <div class="filters">
        <h3>Filters</h3>
        <form method="get">
            <label>Category:</label>
            <select name="category">
                <option value="">All Categories</option>
                ${this.tags.each(this.data.categories, {
                  do: (item: unknown) => {
                    const category = item as string;
                    return html`<option value="${category}" ${this.data.filters?.category === category ? 'selected' : ''}>${category}</option>`;
                  }
                })}
            </select>
            
            <label>Stock Status:</label>
            <select name="inStock">
                <option value="">All</option>
                <option value="true" ${this.data.filters?.inStock === 'true' ? 'selected' : ''}>In Stock</option>
                <option value="false" ${this.data.filters?.inStock === 'false' ? 'selected' : ''}>Out of Stock</option>
            </select>
            
            <label>Search:</label>
            <input type="text" name="search" placeholder="Search products..." value="${this.data.filters?.search ?? ''}" />
            
            <button type="submit">Filter</button>
        </form>
    </div>
    
    <div class="products-grid">
        ${this.tags.each(this.data.products, {
          do: (item: unknown) => {
            const product = item as Product;
            return html`
              <div class="product-card">
                  <h3>${product.name}</h3>
                  <p>${product.description}</p>
                  <div class="price">${this.data.config.priceDisplayCurrency} ${product.price.toFixed(2)}</div>
                  <div class="category">${product.category}</div>
                  <div class="stock-status ${product.inStock ? 'in-stock' : 'out-of-stock'}">
                      ${product.inStock ? 'In Stock' : 'Out of Stock'}
                  </div>
                  <div class="tags">
                      ${this.tags.each(product.tags, {
                        do: (tagItem: unknown) => {
                          const tag = tagItem as string;
                          return html`<span class="tag">${tag}</span>`;
                        }
                      })}
                  </div>
                  <div class="meta">
                      <small>Added: ${product.createdAt.toLocaleDateString()}</small>
                  </div>
              </div>
            `;
          }
        })}
    </div>
    
    ${this.tags.if(this.data.products.length === 0, {
      then: html`
        <div style="text-align: center; padding: 40px; color: #666;">
            <h3>No products found</h3>
            <p>Try adjusting your filters or search terms.</p>
        </div>
      `
    })}
</body>
</html>
`;
  }
}

declare module "../../../src/modules/templates/types" {
  interface Templates {
    ProductListTemplate: ProductListTemplate;
  }
}
