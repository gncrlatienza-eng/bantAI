targetScope = 'resourceGroup'

@description('Short resource prefix for the restricted pilot.')
param prefix string = 'bantai-student'

@description('Azure region costed for this pilot.')
param location string = 'eastasia'

@description('Budget and continuation review date; does not shut down or delete resources.')
param reviewAfter string

@description('Named operator responsible for the student testing environment.')
param pilotOperator string = 'Reymark'

@description('Immutable ACR image reference for the backend.')
param backendImage string

@description('Immutable ACR image reference for the approved Model-C service.')
param aiImage string

@description('Immutable ACR image reference for the same-origin web app.')
param webImage string

@description('Immutable ACR image reference for the one-time Prisma migration job.')
param migrationImage string

@description('Immutable ACR image reference for the least-privilege database role bootstrap job.')
param dbInitImage string

@secure()
@description('New PostgreSQL administrator password. Used only to create the private server and database URL secret.')
param postgresAdminPassword string

@secure()
@description('Password for the least-privilege bantai_app database role.')
param databaseAppPassword string

@secure()
@description('Backend-only secrets. Values are written to the backend Key Vault.')
param backendSecrets object

@secure()
@description('AI-only secrets. Values are written to the AI Key Vault.')
param aiSecrets object

@description('Create the manual database bootstrap and migration jobs after immutable images are available in ACR.')
param deployJobs bool = false

@description('Write application secrets only after provider-specific values, including the Stripe webhook signing secret, are ready.')
param deploySecrets bool = false

@description('Create the web, backend and AI apps only after both database jobs have completed successfully.')
param deployApps bool = false

@description('Provision foundation only in the initial phase; later phases reference existing resources.')
param deployFoundation bool = !deployJobs && !deployApps

@description('Enable campaign matching only when an approved campaign_space.json and compatible centroids are present in the Model-C bundle.')
param enableCampaignMatching bool = false

@description('Exact proxy count in front of NestJS. Verify against observed Container Apps headers before wider release.')
@minValue(0)
@maxValue(3)
param trustProxyHops int = 1

var suffix = take(uniqueString(resourceGroup().id), 8)
var tags = {
  application: 'bantai'
  environment: 'student-test'
  sourceSha: 'b5dd8707f55d27314e1ed780ab619448d435f063'
  reviewAfter: reviewAfter
  costCeilingUsd: '25'
  managedBy: 'bantai-student-pr112'
  resourcePrefix: prefix
  pilotOperator: pilotOperator
}
var vnetName = '${prefix}-vnet'
var environmentName = '${prefix}-apps'
var databaseServerName = '${prefix}-pg-${suffix}'
var registryName = 'bantaistudent${suffix}'
var backendVaultName = 'bantai-be-${suffix}'
var aiVaultName = 'bantai-ai-${suffix}'
var migrationVaultName = 'bantai-db-${suffix}'
var workspaceName = '${prefix}-logs'
var backendName = '${prefix}-backend'
var aiName = '${prefix}-ai'
var webName = '${prefix}-web'
var migrationJobName = '${prefix}-migrate'
var dbInitJobName = '${prefix}-db-init'
var databaseName = 'bantai_db'
var databaseAdmin = 'bantaiadmin'

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = if (deployFoundation) {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.73.0.0/16'
      ]
    }
  }
}

resource appsSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = if (deployFoundation) {
  name: 'apps'
  parent: vnet
  properties: {
    addressPrefix: '10.73.0.0/23'
    delegations: [
      {
        name: 'container-apps'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
  }
}

resource databaseSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = if (deployFoundation) {
  name: 'database'
  parent: vnet
  // Azure serializes writes to subnets of the same VNet.
  dependsOn: [appsSubnet]
  properties: {
    addressPrefix: '10.73.2.0/28'
    delegations: [
      {
        name: 'postgresql'
        properties: {
          serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
        }
      }
    ]
  }
}

resource postgresDns 'Microsoft.Network/privateDnsZones@2020-06-01' = if (deployFoundation) {
  name: 'private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (deployFoundation) {
  name: 'bantai-vnet-link'
  parent: postgresDns
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = if (deployFoundation) {
  name: databaseServerName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: databaseAdmin
    administratorLoginPassword: postgresAdminPassword
    network: {
      delegatedSubnetResourceId: databaseSubnet.id
      privateDnsZoneArmResourceId: postgresDns.id
      publicNetworkAccess: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
  }
  dependsOn: [postgresDnsLink]
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = if (deployFoundation) {
  name: databaseName
  parent: postgres
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = if (deployFoundation) {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployFoundation) {
  name: '${prefix}-backend'
  location: location
  tags: tags
}

resource aiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployFoundation) {
  name: '${prefix}-ai'
  location: location
  tags: tags
}

resource webIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployFoundation) {
  name: '${prefix}-web'
  location: location
  tags: tags
}

resource migrationIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployFoundation) {
  name: '${prefix}-migration'
  location: location
  tags: tags
}

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(registry.id, backendIdentity.id, 'acrpull')
  scope: registry
  properties: {
    principalId: backendIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

resource aiAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(registry.id, aiIdentity.id, 'acrpull')
  scope: registry
  properties: {
    principalId: aiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

resource webAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(registry.id, webIdentity.id, 'acrpull')
  scope: registry
  properties: {
    principalId: webIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

resource migrationAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(registry.id, migrationIdentity.id, 'acrpull')
  scope: registry
  properties: {
    principalId: migrationIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

resource backendVault 'Microsoft.KeyVault/vaults@2024-11-01' = if (deployFoundation) {
  name: backendVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
  }
}

resource aiVault 'Microsoft.KeyVault/vaults@2024-11-01' = if (deployFoundation) {
  name: aiVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
  }
}

resource migrationVault 'Microsoft.KeyVault/vaults@2024-11-01' = if (deployFoundation) {
  name: migrationVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
  }
}

resource backendVaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(backendVault.id, backendIdentity.id, 'secrets-user')
  scope: backendVault
  properties: {
    principalId: backendIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

resource aiVaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(aiVault.id, aiIdentity.id, 'secrets-user')
  scope: aiVault
  properties: {
    principalId: aiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

resource migrationVaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(migrationVault.id, migrationIdentity.id, 'secrets-user')
  scope: migrationVault
  properties: {
    principalId: migrationIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = if (deploySecrets) {
  name: 'database-url'
  parent: backendVault
  properties: {
    value: 'postgresql://bantai_app:${uriComponent(databaseAppPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require&schema=public'
  }
}

resource databaseAdminUrlSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = if (deployJobs) {
  name: 'database-admin-url'
  parent: migrationVault
  properties: {
    value: 'postgresql://${databaseAdmin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require&schema=public'
  }
}

resource databaseBootstrapUrlSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = if (deployJobs) {
  name: 'database-bootstrap-url'
  parent: migrationVault
  properties: {
    value: 'postgresql://${databaseAdmin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
  }
}

resource databaseAppPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = if (deployJobs) {
  name: 'database-app-password'
  parent: migrationVault
  properties: {
    value: databaseAppPassword
  }
}

resource backendSecretResources 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = [for secret in items(backendSecrets): if (deploySecrets) {
  name: secret.key
  parent: backendVault
  properties: {
    value: secret.value
  }
}]

resource aiSecretResources 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = [for secret in items(aiSecrets): if (deploySecrets) {
  name: secret.key
  parent: aiVault
  properties: {
    value: secret.value
  }
}]

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (deployFoundation) {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: json('0.1')
    }
    sku: {
      name: 'PerGB2018'
    }
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appsEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' = if (deployFoundation) {
  name: environmentName
  location: location
  tags: tags
  // Finish database subnet attachment before ACA updates the shared VNet.
  dependsOn: [postgres]
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: listKeys(workspace.id, workspace.apiVersion).primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: appsSubnet.id
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// Queue carries opaque verification IDs only; bodies remain in the private database.
resource queueStorage 'Microsoft.Storage/storageAccounts@2024-01-01' = if (deployFoundation) {
  name: 'bantqueue${suffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Enabled'
    accessTier: 'Hot'
  }
}
resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2024-01-01' = if (deployFoundation) {
  parent: queueStorage
  name: 'default'
}
resource verificationQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2024-01-01' = if (deployFoundation) {
  parent: queueService
  name: 'cloud-verification'
}
resource backendQueueAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployFoundation) {
  name: guid(verificationQueue.id, backendIdentity.id, 'queue-contributor')
  scope: verificationQueue
  properties: {
    principalId: backendIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '974c5e8b-45b9-4653-ba55-5f855dd0fb88')
  }
}

resource ai 'Microsoft.App/containerApps@2025-01-01' = if (deployApps) {
  name: aiName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${aiIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: appsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        allowInsecure: false
        targetPort: 8001
        transport: 'http'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: aiIdentity.id
        }
      ]
      secrets: [
        {
          name: 'service-api-key'
          keyVaultUrl: '${aiVault.properties.vaultUri}secrets/ai-service-api-key'
          identity: aiIdentity.id
        }
        {
          name: 'campaigns-api-key'
          keyVaultUrl: '${aiVault.properties.vaultUri}secrets/ai-campaigns-api-key'
          identity: aiIdentity.id
        }
        {
          name: 'models-api-key'
          keyVaultUrl: '${aiVault.properties.vaultUri}secrets/ai-models-api-key'
          identity: aiIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'ai'
          image: aiImage
          resources: {
            cpu: json('4.0')
            memory: '8Gi'
          }
          env: [
            { name: 'BANTAI_AI_ENVIRONMENT', value: 'production' }
            { name: 'BANTAI_AI_MODEL_DIR', value: '/models/model' }
            { name: 'BANTAI_AI_MODEL_APPROVAL_PATH', value: '/run/bantai/model-approval.json' }
            { name: 'BANTAI_AI_CENTROID_SOURCE', value: enableCampaignMatching ? 'backend' : 'none' }
            { name: 'BANTAI_AI_BACKEND_URL', value: 'https://${backendName}.${appsEnvironment.properties.defaultDomain}/api' }
            { name: 'BANTAI_AI_CAMPAIGN_REFRESH_SECONDS', value: enableCampaignMatching ? '600' : '0' }
            { name: 'BANTAI_AI_MAX_CONCURRENT_OPERATIONS', value: '1' }
            { name: 'BANTAI_AI_SERVICE_API_KEY', secretRef: 'service-api-key' }
            { name: 'BANTAI_AI_CAMPAIGNS_API_KEY', secretRef: 'campaigns-api-key' }
            { name: 'BANTAI_AI_MODELS_API_KEY', secretRef: 'models-api-key' }
          ]
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/ready', port: 8001, scheme: 'HTTP' }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 60
            }
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 8001, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/ready', port: 8001, scheme: 'HTTP' }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '1' } } }
        ]
      }
    }
  }
  dependsOn: [aiAcrPull, aiVaultReader, aiSecretResources]
}

resource backend 'Microsoft.App/containerApps@2025-01-01' = if (deployApps) {
  name: backendName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${backendIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: appsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 3000
        transport: 'http'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: backendIdentity.id
        }
      ]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/database-url', identity: backendIdentity.id }
        { name: 'jwt-secret', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/jwt-secret', identity: backendIdentity.id }
        { name: 'client-jwt-secret', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/client-jwt-secret', identity: backendIdentity.id }
        { name: 'admin-jwt-secret', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/admin-jwt-secret', identity: backendIdentity.id }
        { name: 'otp-hash-secret', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/otp-hash-secret', identity: backendIdentity.id }
        { name: 'email-otp-hash-secret', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/email-otp-hash-secret', identity: backendIdentity.id }
        { name: 'sender-hash-secret', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/sender-hash-secret', identity: backendIdentity.id }
        { name: 'ai-service-api-key', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/ai-service-api-key', identity: backendIdentity.id }
        { name: 'ai-campaigns-api-key', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/ai-campaigns-api-key', identity: backendIdentity.id }
        { name: 'ai-models-api-key', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/ai-models-api-key', identity: backendIdentity.id }
        { name: 'ai-indicators-api-key', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/ai-indicators-api-key', identity: backendIdentity.id }
        { name: 'semaphore-api-key', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/semaphore-api-key', identity: backendIdentity.id }
        { name: 'gmail-smtp-user', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/gmail-smtp-user', identity: backendIdentity.id }
        { name: 'gmail-smtp-app-password', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/gmail-smtp-app-password', identity: backendIdentity.id }
        { name: 'stripe-secret-key', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/stripe-secret-key', identity: backendIdentity.id }
        { name: 'stripe-webhook-secret', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/stripe-webhook-secret', identity: backendIdentity.id }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'AZURE_CLIENT_ID', value: backendIdentity.properties.clientId }
            { name: 'AZURE_STORAGE_QUEUE_URL', value: '${queueStorage.properties.primaryEndpoints.queue}${verificationQueue.name}' }
            { name: 'CLOUD_VERIFY_MODEL_VERSION', value: 'candidate-2026-09-21-colab-C-local' }
            { name: 'CLOUD_VERIFY_ARTIFACT_DIGEST', value: '2ee84d99a8da734f803e9b20677231879c8e52089d4d407c44a9abff45a817e8' }
            { name: 'CLOUD_VERIFY_ADMISSION_DAILY', value: '10' }
            { name: 'CLOUD_VERIFY_ADMISSION_MONTHLY', value: '120' }
            { name: 'CLOUD_VERIFY_MAX_ATTEMPTS', value: '5' }
            { name: 'CLOUD_VERIFY_LEASE_SECONDS', value: '210' }
            { name: 'CLOUD_VERIFY_VISIBILITY_SECONDS', value: '240' }
            { name: 'CLOUD_VERIFY_WAKE_TIMEOUT_MS', value: '180000' }
            { name: 'CLOUD_VERIFY_WARM_TIMEOUT_MS', value: '3500' }

            { name: 'PORT', value: '3000' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'CLIENT_JWT_SECRET', secretRef: 'client-jwt-secret' }
            { name: 'ADMIN_JWT_SECRET', secretRef: 'admin-jwt-secret' }
            { name: 'OTP_HASH_SECRET', secretRef: 'otp-hash-secret' }
            { name: 'EMAIL_OTP_HASH_SECRET', secretRef: 'email-otp-hash-secret' }
            { name: 'SENDER_HASH_SECRET', secretRef: 'sender-hash-secret' }
            { name: 'AI_SERVICE_URL', value: 'https://${aiName}.internal.${appsEnvironment.properties.defaultDomain}' }
            { name: 'AI_SERVICE_API_KEY', secretRef: 'ai-service-api-key' }
            { name: 'AI_CAMPAIGNS_API_KEY', secretRef: 'ai-campaigns-api-key' }
            { name: 'AI_MODELS_API_KEY', secretRef: 'ai-models-api-key' }
            { name: 'AI_INDICATORS_API_KEY', secretRef: 'ai-indicators-api-key' }
            { name: 'MOBILE_OTP_DELIVERY', value: 'sms' }
            { name: 'SEMAPHORE_API_KEY', secretRef: 'semaphore-api-key' }
            { name: 'SEMAPHORE_SENDER_NAME', value: 'BANTAIPH' }
            { name: 'GMAIL_SMTP_HOST', value: 'smtp.gmail.com' }
            { name: 'GMAIL_SMTP_PORT', value: '465' }
            { name: 'GMAIL_SMTP_USER', secretRef: 'gmail-smtp-user' }
            { name: 'GMAIL_SMTP_APP_PASSWORD', secretRef: 'gmail-smtp-app-password' }
            { name: 'PORTAL_FROM_EMAIL', secretRef: 'gmail-smtp-user' }
            { name: 'STRIPE_CHECKOUT_MODE', value: 'test' }
            { name: 'STRIPE_TEST_PILOT', value: 'true' }
            { name: 'STRIPE_SECRET_KEY', secretRef: 'stripe-secret-key' }
            { name: 'STRIPE_WEBHOOK_SECRET', secretRef: 'stripe-webhook-secret' }
            { name: 'FRONTEND_URL', value: 'https://${webName}.${appsEnvironment.properties.defaultDomain}' }
            { name: 'CORS_ORIGINS', value: 'https://${webName}.${appsEnvironment.properties.defaultDomain}' }
            { name: 'TRUST_PROXY_HOPS', value: string(trustProxyHops) }
            { name: 'API_DOCS_ENABLED', value: 'false' }
            { name: 'RETRAINING_ENABLED', value: 'false' }
            { name: 'CAMPAIGN_ANALYSIS_ENABLED', value: 'false' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 3000, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/health/ready', port: 3000, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 6
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '1' } } }
          {
            name: 'verification-queue'
            custom: {
              type: 'azure-queue'
              identity: backendIdentity.id
              metadata: {
                accountName: queueStorage.name
                queueName: verificationQueue.name
                queueLength: '1'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [ai, databaseUrlSecret, backendSecretResources, backendVaultReader, backendAcrPull, backendQueueAccess]
}

resource web 'Microsoft.App/containerApps@2025-01-01' = if (deployApps) {
  name: webName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: appsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 8080
        transport: 'http'
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: webIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'BACKEND_ORIGIN', value: 'https://${backendName}.${appsEnvironment.properties.defaultDomain}' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/healthz', port: 8080, scheme: 'HTTP' }
              initialDelaySeconds: 5
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/healthz', port: 8080, scheme: 'HTTP' }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '1' } } }
        ]
      }
    }
  }
  dependsOn: [backend, webAcrPull]
}

resource migrationJob 'Microsoft.App/jobs@2025-01-01' = if (deployJobs) {
  name: migrationJobName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${migrationIdentity.id}': {}
    }
  }
  properties: {
    environmentId: appsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 900
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: migrationIdentity.id
        }
      ]
      secrets: [
        { name: 'database-admin-url', keyVaultUrl: '${migrationVault.properties.vaultUri}secrets/database-admin-url', identity: migrationIdentity.id }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: migrationImage
          command: ['npx']
          args: ['prisma', 'migrate', 'deploy', '--schema', 'database/prisma/schema.prisma']
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-admin-url' }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
    }
  }
  dependsOn: [databaseAdminUrlSecret, migrationVaultReader, migrationAcrPull]
}

resource dbInitJob 'Microsoft.App/jobs@2025-01-01' = if (deployJobs) {
  name: dbInitJobName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${migrationIdentity.id}': {}
    }
  }
  properties: {
    environmentId: appsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 300
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: migrationIdentity.id
        }
      ]
      secrets: [
        { name: 'database-bootstrap-url', keyVaultUrl: '${migrationVault.properties.vaultUri}secrets/database-bootstrap-url', identity: migrationIdentity.id }
        { name: 'database-app-password', keyVaultUrl: '${migrationVault.properties.vaultUri}secrets/database-app-password', identity: migrationIdentity.id }
      ]
    }
    template: {
      containers: [
        {
          name: 'db-init'
          image: dbInitImage
          env: [
            { name: 'DATABASE_ADMIN_URL', secretRef: 'database-bootstrap-url' }
            { name: 'DATABASE_APP_PASSWORD', secretRef: 'database-app-password' }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
  dependsOn: [databaseBootstrapUrlSecret, databaseAppPasswordSecret, migrationVaultReader, migrationAcrPull]
}

// A bounded scheduled repair publishes committed outbox entries after queue outages.
resource outboxRepair 'Microsoft.App/jobs@2025-01-01' = if (deployApps) {
  name: '${prefix}-outbox-repair'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${backendIdentity.id}': {} }
  }
  properties: {
    environmentId: appsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 120
      replicaRetryLimit: 1
      scheduleTriggerConfig: {
        cronExpression: '0 3 * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [{ server: registry.properties.loginServer, identity: backendIdentity.id }]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${backendVault.properties.vaultUri}secrets/database-url', identity: backendIdentity.id }
      ]
    }
    template: {
      containers: [{
        name: 'outbox-repair'
        image: backendImage
        command: ['node']
        args: ['dist/src/cloud-verification/repair.js']
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'NODE_ENV', value: 'production' }
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'AZURE_CLIENT_ID', value: backendIdentity.properties.clientId }
          { name: 'AZURE_STORAGE_QUEUE_URL', value: '${queueStorage.properties.primaryEndpoints.queue}${verificationQueue.name}' }
          { name: 'CLOUD_VERIFY_MODEL_VERSION', value: 'candidate-2026-09-21-colab-C-local' }
          { name: 'CLOUD_VERIFY_ARTIFACT_DIGEST', value: '2ee84d99a8da734f803e9b20677231879c8e52089d4d407c44a9abff45a817e8' }
          { name: 'CLOUD_VERIFY_RUN_CONSUMER', value: 'false' }
        ]
      }]
    }
  }
  dependsOn: [databaseUrlSecret, backendVaultReader, backendAcrPull, backendQueueAccess]
}

output registryName string = registry.name
output registryLoginServer string = registry.properties.loginServer
output appsDefaultDomain string = appsEnvironment.properties.defaultDomain
output backendUrl string = deployApps ? 'https://${backendName}.${appsEnvironment.properties.defaultDomain}' : ''
output webUrl string = deployApps ? 'https://${webName}.${appsEnvironment.properties.defaultDomain}' : ''
output aiAppName string = deployApps ? ai.name : ''
output migrationJobName string = deployJobs ? migrationJob.name : ''
output dbInitJobName string = deployJobs ? dbInitJob.name : ''
output reviewAfter string = reviewAfter

output queueUrl string = '${queueStorage.properties.primaryEndpoints.queue}${verificationQueue.name}'
