require('dotenv').config();

module.exports = {
  expo: {
    name: "KOUZO",
    slug: "delivery-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "deliveryapp",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#1a1a2e"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.delivery.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Cette application a besoin de votre position pour afficher votre emplacement sur la carte.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Cette application a besoin de votre position pour la navigation en temps réel."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1a1a2e"
      },
      edgeToEdgeEnabled: true,
      package: "com.delivery.app",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN
        }
      ],
      "expo-router",
      "expo-mail-composer",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Cette application a besoin de votre position pour la navigation."
        }
      ]
    ],
    extra: {
      router: {},
      eas: {
        projectId: "d927d99e-9b74-4193-96d5-acd43873e37d"
      },
      // Expose environment variables to app
      MAPBOX_PUBLIC_TOKEN: process.env.MAPBOX_PUBLIC_TOKEN,
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY
    }
  }
};
