package io.cpaas.gateway

import android.app.Application
import io.cpaas.gateway.data.TokenStore

class CpaasApp : Application() {
  lateinit var tokenStore: TokenStore
    private set

  override fun onCreate() {
    super.onCreate()
    tokenStore = TokenStore(this)
  }
}
