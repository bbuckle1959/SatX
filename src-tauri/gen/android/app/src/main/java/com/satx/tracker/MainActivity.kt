package com.satx.tracker

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    requestLocationIfNeeded()
  }

  private fun requestLocationIfNeeded() {
    val fine = Manifest.permission.ACCESS_FINE_LOCATION
    val coarse = Manifest.permission.ACCESS_COARSE_LOCATION
    val hasFine =
      ContextCompat.checkSelfPermission(this, fine) == PackageManager.PERMISSION_GRANTED
    val hasCoarse =
      ContextCompat.checkSelfPermission(this, coarse) == PackageManager.PERMISSION_GRANTED
    if (!hasFine && !hasCoarse) {
      ActivityCompat.requestPermissions(this, arrayOf(fine, coarse), LOCATION_REQUEST_CODE)
    }
  }

  companion object {
    private const val LOCATION_REQUEST_CODE = 9021
  }
}
