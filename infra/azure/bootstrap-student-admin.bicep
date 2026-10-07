targetScope = 'resourceGroup'

@description('Exact already-published backend image digest.')
param backendImage string
@secure()
param bootstrapPasswordHash string
param prefix string = 'bantai-student'
param location string = 'eastasia'

var suffix = take(uniqueString(resourceGroup().id), 8)
resource environment 'Microsoft.App/managedEnvironments@2025-01-01' existing = {
  name: '${prefix}-apps'
}
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: '${prefix}-backend'
}
resource vault 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: 'bantai-be-${suffix}'
}
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: 'bantaistudent${suffix}'
}

// Manual administrator bootstrap only. Reuses existing scoped identity and
// secrets; creates only the exact operator-approved first administrator.
resource verification 'Microsoft.App/jobs@2025-01-01' = {
  name: '${prefix}-admin-bootstrap'
  location: location
  tags: {
    application: 'bantai'
    environment: 'student-test'
    managedBy: 'bantai-student-pr112'
    sourceSha: 'b5dd8707f55d27314e1ed780ab619448d435f063'
    purpose: 'first-admin-bootstrap'
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 900
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${vault.properties.vaultUri}secrets/database-url', identity: identity.id }
        { name: 'admin-bootstrap-password-hash', value: bootstrapPasswordHash }
      ]
    }
    template: {
      containers: [{
        name: 'verify'
        image: backendImage
        command: ['node']
        args: ['-e', loadTextContent('bootstrap-student-admin.cjs')]
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'BOOTSTRAP_ADMIN_PASSWORD_HASH', secretRef: 'admin-bootstrap-password-hash' }
          { name: 'BOOTSTRAP_ADMIN_EMAIL', value: 'reymarkdecastro59@gmail.com' }
        ]
      }]
    }
  }
}

output jobName string = verification.name
