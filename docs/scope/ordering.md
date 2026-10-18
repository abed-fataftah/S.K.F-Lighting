# Ordering

Part of the [S.K.F Lighting scope](index.md). From cart to a saved order you can manage, including cancellations.

## Slice 3: Cart & checkout

### 12. Cart
Review chosen products with their options, change quantities, remove items, and see the total.
**Done when:** the cart keeps its items between visits, the total updates as quantities change, and items that went out of stock are flagged before ordering.
- [ ] Build it: `/develop cart`

### 13. Checkout & delivery · needs a decision
The order form: full name, phone, area and city or town, a detailed address when delivery is chosen, and optional notes. Choose shop pickup or delivery; the delivery fee (West Bank ₪20, ’48 areas ₪70) is added to the total.
**Done when:** invalid or unrealistic entries are rejected with clear messages in the customer's language, the address is required only for delivery, and the total shows the correct fee for the chosen area.
- [ ] Design it (spec): `/architect checkout & delivery`

### 14. Order confirmation & WhatsApp
After sending, a confirmation page with the order number and summary, WhatsApp opened with the full order message, and a WhatsApp contact button that includes the order number.
**Done when:** every order gets a unique, easy to read order number, the WhatsApp message lists items, options, quantities, fee, and total, and the contact button works on phones and computers.
- [ ] Build it: `/develop order confirmation & whatsapp`

## Slice 4: Managing orders

### 15. Order management · needs a decision
The dashboard order list and order details: customer details, items, totals, delivery choice, and status changes, with new orders flagged so none is missed.
**Done when:** you can filter orders by status and date, open one to see everything about it, move it through its statuses, and new or cancelled orders stand out until you open them.
- [ ] Design it (spec): `/architect order management`

### 16. Order page & guest lookup · needs a decision
A page for each order showing its status and items, with a WhatsApp contact button carrying the order number. Guests reach it with their order number plus phone number.
**Done when:** a guest with the right order number and phone sees their order, wrong pairs show nothing about any order, and repeated wrong attempts are slowed down.
- [ ] Design it (spec): `/architect order page & guest lookup`

### 17. Cancel before delivery · needs a decision
Customers cancel an order from its order page at any stage before delivery. The cancellation shows in your dashboard and opens WhatsApp with a cancellation message to you.
**Done when:** the cancel button appears only before delivery, a cancelled order is clearly marked in the dashboard and in the customer's view, and the WhatsApp message includes the order number.
- [ ] Design it (spec): `/architect cancel before delivery`
