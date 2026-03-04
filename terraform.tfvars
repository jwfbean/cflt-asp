# terraform.tfvars

# Confluent Cloud Credentials
# Found under "Administration" > "API Keys" 
# Must be a "Global/Cloud" key for infrastructure management


#
# This is the only file with these credentials! Don't edit until you move them!
#

confluent_cloud_api_key    = "TE6HV7CYLULVJYTC"
confluent_cloud_api_secret = "cfltqdQdMXFMaMXOMJK9/ahHmoKiDznTamxjZNFwE57ziyWIgqoAcPM6j3ekxHDQ"

# MongoDB Atlas Credentials
# Found under "Access Manager" > "Organization Settings" > "API Keys"
mongodbatlas_public_key  = "ejnfxzgu"
mongodbatlas_private_key = "73fd7d66-4686-44ac-beb7-87f8737ed0fc"
mongodbatlas_org_id      = "697006503ef4f940cb07ae96"

# Database User Settings
mongodb_username = "jwfbean-demo"
mongodb_password = "i-am-super-secure-123"
