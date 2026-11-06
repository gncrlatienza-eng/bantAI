targetScope = 'resourceGroup'

@description('Exact already-published backend image digest.')
param backendImage string
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

// Manual synthetic verification only. Reuses existing scoped identity and
// secrets; does not grant permissions, alter customer accounts or send OTPs.
resource verification 'Microsoft.App/jobs@2025-01-01' = {
  name: '${prefix}-release-verify'
  location: location
  tags: {
    application: 'bantai'
    environment: 'student-test'
    managedBy: 'bantai-student-pr112'
    sourceSha: 'b5dd8707f55d27314e1ed780ab619448d435f063'
    purpose: 'synthetic-release-verification'
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
        { name: 'jwt-secret', keyVaultUrl: '${vault.properties.vaultUri}secrets/jwt-secret', identity: identity.id }
      ]
    }
    template: {
      containers: [{
        name: 'verify'
        image: backendImage
        command: ['node']
        args: ['-e', loadTextContent('verify-student-cloud.cjs')]
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
          { name: 'CLOUD_VERIFY_SMOKE_API_URL', value: 'https://${prefix}-web.${environment.properties.defaultDomain}/api' }
        ]
      }]
    }
  }
}

output jobName string = verification.name
