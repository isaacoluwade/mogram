resource "azurerm_resource_group" "main" {
  name     = "tfcourse-dev-eus-rg"
  location = "eastus"

  tags = {
    project     = "tfcourse"
    environment = "dev"
    managed_by  = "terraform"
  }
}

# Replace abc12 with a few characters of your own.
# A storage account name has to be unique across all of Azure.
resource "azurerm_storage_account" "storage" {
  name                     = "tfcoursedeveusabc12st"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    project     = "tfcourse"
    environment = "dev"
    managed_by  = "terraform"
  }
}
