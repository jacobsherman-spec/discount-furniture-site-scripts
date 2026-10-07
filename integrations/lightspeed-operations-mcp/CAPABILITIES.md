# Discount Furniture Lightspeed operation catalog

Generated from Lightspeed API 2026-07 plus the official 2026-10 Products migration contract.

- Implemented operations: 201
- Read-only operations: 107
- Preview-gated write operations: 94
- Excluded source operations: 18
- Source SHA-256: `d5537aa408bb9b79aedd9eb9efc05a38e881635683cef08f13108e4665dca4f9`

Every write is exposed only through a signed, expiring preview receipt. The execute tool rechecks the baseline and reserves an audit record before calling Lightspeed.

## Brands

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateBrand` | POST | write | business_record_write | products:write |
| `DeleteBrandByID` | DELETE | write | destructive | products:write |
| `GetBrandByID` | GET | read | read_only | products:read |
| `ListBrands` | GET | read | read_only | products:read |
| `UpdateBrandById` | PUT | write | business_record_write | products:write |

## Channel Request Log

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `getSingleRequest` | GET | read | read_only | channels:read |
| `getSingleRequestText` | GET | read | read_only | channels:read |
| `listChannels` | GET | read | read_only | channels:read |
| `listRequests` | GET | read | read_only | channels:read |

## Consignment Products

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateConsignmentProduct` | POST | write | inventory_control | consignments:write:inventory_count, consignments:write:stock_order, consignments:write:stock_transfer |
| `CreateOrUpdateConsignmentProducts` | POST | write | inventory_control | consignments:write:inventory_count, consignments:write:stock_order, consignments:write:stock_transfer |
| `DeleteProductFromConsignment` | DELETE | write | destructive | consignments:write:inventory_count, consignments:write:stock_order, consignments:write:stock_transfer |
| `ListProductsByConsignmentID` | GET | read | read_only | consignments:read |
| `UpdateProductInConsignment` | PUT | write | inventory_control | consignments:write:inventory_count, consignments:write:stock_order, consignments:write:stock_transfer |

## Consignments

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateConsignment` | POST | write | inventory_control | consignments:write:inventory_count, consignments:write:stock_order, consignments:write:stock_transfer |
| `DeleteConsignmentByID` | DELETE | write | destructive | consignments:write:inventory_count, consignments:write:stock_order, consignments:write:stock_transfer |
| `GetConsignmentByID` | GET | read | read_only | consignments:read |
| `GetConsignments` | GET | read | read_only | consignments:read |
| `ListConsignmentTotals` | GET | read | read_only | consignments:read |
| `UpdateConsignmentByID` | PUT | write | inventory_control | consignments:write:inventory_count, consignments:write:stock_order, consignments:write:stock_transfer |

## Customer Addresses

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateCustomerAddress` | POST | write | business_record_write | customers:write |
| `DeleteCustomerAddress` | DELETE | write | destructive | customers:write |
| `GetCustomerAddress` | GET | read | read_only | customers:read |
| `ListCustomerAddresses` | GET | read | read_only | customers:read |
| `UpdateCustomerAddress` | PUT | write | business_record_write | customers:write |

## Customer Contact Channels

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateCustomerContactChannel` | POST | write | business_record_write | customers:write |
| `DeleteCustomerContactChannel` | DELETE | write | destructive | customers:write |
| `GetCustomerContactChannel` | GET | read | read_only | customers:read |
| `ListCustomerContactChannels` | GET | read | read_only | customers:read |
| `SetCustomerContactChannels` | PUT | write | business_record_write | customers:write |
| `SetDefaultCustomerContactChannel` | POST | write | business_record_write | customers:write |
| `UpdateCustomerContactChannel` | PUT | write | business_record_write | customers:write |

## Customer Groups

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `AddCustomersToCustomerGroup` | POST | write | business_record_write | customers:write |
| `CreateCustomerGroup` | POST | write | business_record_write | customers:write |
| `DeleteCustomersFromCustomerGroup` | DELETE | write | destructive | customers:write |
| `GetCustomerGroupById` | GET | read | read_only | customers:read |
| `GetCustomerGroupCustomers` | GET | read | read_only | customers:read |
| `ListCustomerGroups` | GET | read | read_only | customers:read |
| `UpdateCustomerGroup` | PUT | write | business_record_write | customers:write |

## Customers

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateCustomer` | POST | write | business_record_write | customers:write |
| `CustomerTaxesBulkUpdate` | POST | write | business_record_write | customers:write |
| `DeleteCustomerByID` | DELETE | write | destructive | customers:write |
| `GetCustomerByID` | GET | read | read_only | customers:read |
| `ListCustomers` | GET | read | read_only | customers:read |
| `ListCustomerTaxes` | GET | read | read_only | customers:read |
| `UpdateCustomerByID` | PUT | write | business_record_write | customers:write |

## Fulfillments

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `getFulfillmentHistory` | GET | read | read_only | fulfillments:read |
| `getFulfillmentSummary` | GET | read | read_only | fulfillments:read |
| `postFulfillLineItems` | POST | write | high_impact | sales:write |
| `postFulfillSale` | POST | write | high_impact | sales:write |
| `postPackLineItems` | POST | write | business_record_write | sales:write |
| `postPickLineItems` | POST | write | business_record_write | sales:write |

## Gift Cards

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateGiftCard` | POST | write | financial_or_sale_record | gift_cards:write:issue |
| `CreateGiftCardTransaction` | POST | write | financial_or_sale_record | gift_cards:write:redeem |
| `FindGiftCardById` | GET | read | read_only | gift_cards:read |
| `FindGiftCardByNumber` | GET | read | read_only | gift_cards:read |
| `FindGiftCardByTransactionId` | GET | read | read_only | gift_cards:read |
| `ListGiftCards` | GET | read | read_only | gift_cards:read |
| `ReverseGiftCardTransaction` | DELETE | write | financial_or_sale_record | gift_cards:write:redeem |
| `VoidGiftCard` | DELETE | write | financial_or_sale_record | gift_cards:write:issue |
| `VoidGiftCardById` | DELETE | write | financial_or_sale_record | gift_cards:write:issue |
| `VoidGiftCardByNumber` | DELETE | write | financial_or_sale_record | gift_cards:write:issue |

## Inventory

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateCustomInventoryAdjustmentReason` | POST | write | inventory_control | inventory:write |
| `CreateStockAdjustments` | POST | write | inventory_control | inventory:write |
| `ListCustomInventoryAdjustmentReasons` | GET | read | read_only | inventory:write |
| `ListInventoryLevels` | POST | read | read_only | inventory:read |
| `ListInventoryRecords` | POST | read | read_only | inventory:read |
| `ListProductInventoryLevels` | GET | read | read_only | inventory:read |
| `ListProductInventoryRecords` | GET | read | read_only | inventory:read |
| `ListStockAdjustments` | GET | read | read_only | inventory:write |
| `SetReorderPoints` | POST | write | inventory_control | inventory:write |
| `UpdateCustomInventoryAdjustmentReason` | PUT | write | inventory_control | inventory:write |

## Outlet Product Taxes

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `listOutletProductTaxes` | GET | read | read_only | outlets:read |

## Outlets

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `GetOutletByID` | GET | read | read_only | outlets:read |
| `ListOutlets` | GET | read | read_only | outlets:read |

## Packing Slips

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `getPackingSlip` | GET | read | read_only | sales:read |
| `getPartialPackingSlip` | POST | read | read_only | sales:read |

## Payment Types

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `ListPaymentTypes` | GET | read | read_only | payment_types:read |

## Price Books

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `AddPriceBookProducts` | POST | write | business_record_write | products:read, products:write:price_books |
| `CreatePriceBookV3` | POST | write | business_record_write | customers:read, products:write:price_books |
| `DeletePriceBookProducts` | DELETE | write | destructive | products:write:price_books |
| `GetPriceBookByIDV3` | GET | read | read_only | customers:read, outlets:read, products:read:price_books |
| `GetPriceBookProductsForPriceBook` | GET | read | read_only | products:read:price_books |
| `ListPriceBookProducts` | GET | read | read_only | products:read:price_books |
| `ListPriceBooksV3` | GET | read | read_only | customers:read, outlets:read, products:read:price_books |
| `UpdatePriceBookProducts` | PATCH | write | business_record_write | products:read, products:write:price_books |
| `UpdatePriceBookProductsWithPutOp` | PUT | write | business_record_write | products:read, products:write:price_books |
| `UpdatePriceBookV3` | PUT | write | business_record_write | customers:read, products:write:price_books |

## Product Categories

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateUpdateProductCategories` | POST | write | business_record_write | products:write |
| `DeleteProductCategories` | DELETE | write | destructive | products:write |
| `ListProductCategories` | GET | read | read_only | products:read |

## Product Images

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `DeleteProductImageByID` | DELETE | write | destructive | products:write |
| `GetProductImageDataByID` | GET | read | read_only | products:read |
| `SetImagePosition` | PUT | write | business_record_write | products:write |

## Product Types

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `GetProductTypeByID` | GET | read | read_only | products:read |
| `ListProductTypes` | GET | read | read_only | products:read |

## Products

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateProduct` | POST | write | business_record_write | products:write |
| `DeleteProduct` | DELETE | write | destructive | products:write |
| `DeleteProductFamily` | DELETE | write | destructive | products:write |
| `GetPriceBooksForProduct` | GET | read | read_only | products:read:price_books |
| `GetProductByID` | GET | read | read_only | products:read |
| `ListProducts` | GET | read | read_only | products:read |
| `UpdateProduct` | PUT | write | business_record_write | products:write |

## Products 2026-10

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `AddProductToFamily202610` | POST | write | business_record_write | products:write |
| `CreateProductFamily202610` | POST | write | business_record_write | products:write |
| `DeleteProduct202610` | DELETE | write | destructive | products:write |
| `DeleteProductFamily202610` | DELETE | write | destructive | products:write |
| `GetProduct202610` | GET | read | read_only | products:read |
| `GetProductFamily202610` | GET | read | read_only | products:read |
| `GetProductFamilyForProduct202610` | GET | read | read_only | products:read |
| `ListProducts202610` | GET | read | read_only | products:read |
| `UpdateProduct202610` | PATCH | write | business_record_write | products:write |
| `UpdateProductFamily202610` | PATCH | write | business_record_write | products:write |

## Promo Code

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `DeletePromoCodesBulk` | DELETE | write | destructive | promotions:write |
| `GetActivePromoCodesBulk` | POST | read | read_only | promotions:read |

## Promotions

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `ApplyDiscount` | POST | read | read_only | outlets:read, promotions:read |
| `CreatePromotion` | POST | write | business_record_write | promotions:write |
| `GetPromotionByID` | GET | read | read_only | promotions:read |
| `GetPromotionProducts` | GET | read | read_only | products:read, promotions:read |
| `GetPromotionPromoCodes` | GET | read | read_only | promotions:read |
| `ListPromotions` | GET | read | read_only | promotions:read |
| `SearchPromotions` | GET | read | read_only | promotions:read |
| `UpdatePromotion` | PUT | write | business_record_write | promotions:write |

## Purchase Orders

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `GetPurchaseOrderByID` | GET | read | read_only | consignments:read, products:read:costs |
| `ListPurchaseOrderDeliveries` | GET | read | read_only | consignments:read, products:read:costs |
| `ListPurchaseOrderDeliveryLineItems` | GET | read | read_only | consignments:read, products:read:costs |
| `ListPurchaseOrderLineItems` | GET | read | read_only | consignments:read, products:read:costs |
| `ListPurchaseOrders` | GET | read | read_only | consignments:read, products:read:costs |

## Quotes

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `get-quote-quote_id` | GET | read | read_only | sales:read |
| `get-quotes` | GET | read | read_only | sales:read |

## Registers

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CloseRegister` | PUT | write | financial_or_sale_record | payment_types:read, register:close |
| `GetButtonLayoutById` | GET | read | read_only | registers:read |
| `GetRegisterByID` | GET | read | read_only | registers:read |
| `ListButtonLayouts` | GET | read | read_only | registers:read |
| `ListRegisters` | GET | read | read_only | registers:read |
| `OpenRegister` | PUT | write | financial_or_sale_record | register:open |
| `RegisterPaymentsSummary` | GET | read | read_only | payments:read |

## Retailers

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `GetRetailer` | GET | read | read_only | payment_types:read, retailer:read |

## Sales

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateSale` | POST | write | financial_or_sale_record | sales:write |
| `GetSaleByID` | GET | read | read_only | sales:read |
| `initReturnSale` | POST | write | financial_or_sale_record | sales:write, users:read |
| `ListSales` | GET | read | read_only | sales:read |
| `UpdateSale` | PUT | write | financial_or_sale_record | sales:write |

## Search

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `Search` | GET | read | read_only | customers:read, products:read, sales:read |

## Serial Numbers

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `create-serialnumber` | POST | write | business_record_write | serial_numbers:write |
| `delete-serialnumber` | DELETE | write | destructive | serial_numbers:write |
| `get-serialnumber` | GET | read | read_only | serial_numbers:read |
| `get-serialnumbers` | GET | read | read_only | serial_numbers:read |

## Service Orders

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateService` | POST | write | business_record_write | sales:write, services:write |
| `CreateServiceStatus` | POST | write | business_record_write | services:write |
| `DeleteServiceStatus` | DELETE | write | destructive | services:write |
| `get-agenda-outlet_id` | GET | read | read_only | services:read |
| `GetService` | GET | read | read_only | services:read |
| `GetServiceStatus` | GET | read | read_only | services:read |
| `ListServiceItems` | GET | read | read_only | services:read |
| `ListServices` | GET | read | read_only | services:read |
| `ListServiceStatuses` | GET | read | read_only | services:read |
| `UpdateServiceStatus` | PATCH | write | business_record_write | services:write |

## Store Credits

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `BulkBalancesStoreCreditList` | POST | read | read_only | store_credits:read |
| `BulkStoreCreditList` | POST | read | read_only | store_credits:read |
| `CreateStoreCreditHold` | POST | write | financial_or_sale_record | store_credits:write:redeem |
| `CreateStoreCreditTransaction` | POST | write | financial_or_sale_record | store_credits:write:issue, store_credits:write:redeem |
| `ListStoreCredit` | GET | read | read_only | store_credits:read |
| `ListStoreCreditForCustomer` | GET | read | read_only | store_credits:read |
| `ReverseStoreCreditHold` | POST | write | financial_or_sale_record | store_credits:write:redeem |
| `StoreCreditBalanceForCustomer` | GET | read | read_only | store_credits:read |
| `StoreCreditReport` | GET | read | read_only | store_credits:read |

## Suppliers

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateSupplier` | POST | write | business_record_write | suppliers:write |
| `DeleteSupplierById` | DELETE | write | destructive | suppliers:write |
| `GetSupplierByID` | GET | read | read_only | suppliers:read |
| `ListSuppliers` | GET | read | read_only | suppliers:read |
| `UpdateSupplierByID` | PUT | write | business_record_write | suppliers:write |

## Tags

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateTag` | POST | write | business_record_write | products:write |
| `DeleteTagByID` | DELETE | write | destructive | products:write |
| `GetTagByID` | GET | read | read_only | products:read |
| `ListTags` | GET | read | read_only | products:read |
| `UpdateTagByID` | PUT | write | business_record_write | products:write |

## Taxes

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateTax` | POST | write | business_record_write | taxes:write |
| `GetTaxByID` | GET | read | read_only | taxes:read |
| `ListTaxes` | GET | read | read_only | taxes:read |

## Users

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `GetSalesTotalsForUserByID` | GET | read | read_only | sales:read, users:read |
| `GetUser` | GET | read | read_only | users:read |
| `GetUserByID` | GET | read | read_only | users:read |
| `GetUsersById` | POST | read | read_only | users:read |
| `ListUsers` | GET | read | read_only | users:read |

## Variant Attributes

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateVariantAttribute` | POST | write | business_record_write | products:write |
| `DeleteVariantAttribute` | DELETE | write | destructive | products:write |
| `GetVariantAttributes` | GET | read | read_only | products:read |
| `ListVariantAttributes` | GET | read | read_only | products:read |
| `UpdateVariantAttribute` | PUT | write | business_record_write | products:write |

## Webhooks

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `delete-webhooks-webhookId` | DELETE | write | destructive | webhooks |
| `get-webhooks` | GET | read | read_only | webhooks |
| `get-webhooks-id` | GET | read | read_only | webhooks |
| `post-webhooks` | POST | write | business_record_write | webhooks |
| `put-webhooks-id` | PUT | write | business_record_write | webhooks |

## Workflows

| Operation | Method | Effect | Risk | Required scopes |
|---|---:|---|---|---|
| `CreateCustomField` | POST | write | business_record_write | custom_fields:write |
| `delete-custom-field` | DELETE | write | destructive | custom_fields:write |
| `GetCustomFields` | GET | read | read_only | custom_fields:read |
| `GetCustomFieldValues` | GET | read | read_only | custom_fields:read |
| `SetCustomFieldValues` | POST | write | business_record_write | custom_fields:write |
| `update-custom-field` | PUT | write | business_record_write | custom_fields:write |

## Deliberate gaps

- Product image upload remains specialized/browser-assisted because the API endpoint is multipart rather than JSON.
- Card charging/refunding and receipt transmission are not implied by sale/payment record access.
- Partner billing, security audit, primary-admin identity, business-rule, and remote-rule scopes are excluded.
- Physical on-hand must not be conflated with `inventory_levels.current_inventory_level`, which Lightspeed documents as available-to-sell.
