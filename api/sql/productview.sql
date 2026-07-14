-- Reference SQL schema for productview (MongoDB collection: productview)
-- Maps to api/models/ProductView.js

CREATE TABLE productview (
  id          VARCHAR(24)  NOT NULL PRIMARY KEY,
  productID   VARCHAR(24)  NOT NULL,
  userID      VARCHAR(24)  NOT NULL,
  dateAdded   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active',
  createdAt   DATETIME     NULL,
  updatedAt   DATETIME     NULL,
  CONSTRAINT fk_productview_product FOREIGN KEY (productID) REFERENCES products(id),
  CONSTRAINT fk_productview_user    FOREIGN KEY (userID)    REFERENCES users(id),
  CONSTRAINT uq_productview_user_product_active UNIQUE (productID, userID, status)
);

CREATE INDEX idx_productview_product_status ON productview (productID, status);
CREATE INDEX idx_productview_user ON productview (userID);
