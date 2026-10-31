import { AppHeader, Button, Card } from "@/src/ui/components";
import { colors, layout, radii, spacing, typography } from "@/src/ui/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppAlert as Alert } from "@/src/ui/AppAlert";
import { userErrorMessage } from "@/src/ui/userErrorMessages";
import PrescriptionWriteGuard from "@/src/care-target/PrescriptionWriteGuard";
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Linking,
  StatusBar,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";

import { uploadPrescriptionImage } from "@/firebase/uploadPrescriptionImage";
import { useAuth } from "@/src/auth/useAuth";
import { analyzePrescriptionByUrl } from "@/src/api/analyzePrescription";
import { useActiveCareTarget } from "@/src/care-target/useActiveCareTarget";
import { translations } from "@/src/i18n/translations";
import { useLanguage } from "@/src/store/LanguageContext";

function CameraScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [qrMode, setQrMode] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [refreshKey, setRefreshKey] = useState(0);

  const { user } = useAuth();
  const { activePatientId } = useActiveCareTarget();
  const { language } = useLanguage();
  const t = translations[language];

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.cameraAlbumPermissionTitle, t.cameraAlbumPermissionMessage);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: true,
    });

    if (result.canceled) return;
    setImageUri(result.assets?.[0]?.uri ?? null);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.cameraPermissionTitle, t.cameraPermissionMessage);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: true,
    });

    if (result.canceled) return;
    setImageUri(result.assets?.[0]?.uri ?? null);
  }

  async function openQrScanner() {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();

      if (!result.granted) {
        Alert.alert(t.cameraPermissionTitle, t.cameraQrPermissionMessage);
        return;
      }
    }

    setScanned(false);
    setQrMode(true);
  }

  async function handleQrScanned(result: { data: string }) {
    if (scanned) return;

    setScanned(true);

    const url = result.data.trim();

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setQrMode(false);
      Alert.alert(t.cameraInvalidQrTitle, t.cameraInvalidQrMessage);
      return;
    }

    // 先讓 CameraView 卸載
    setQrMode(false);

    setRefreshKey(prev => prev + 1);

    // Defer opening the browser until the camera has left the rendered tree.
    // InteractionManager is no longer exported by React Native in SDK 58.
    setTimeout(async () => {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(t.cameraOpenFailed);
      }
    }, 300);
  }

  async function goNext() {
    if (isAnalyzing) {
      return;
    }

    if (!imageUri) {
      Alert.alert(t.cameraNoPhotoTitle, t.cameraNoPhotoMessage);
      return;
    }

    if (!user) {
      Alert.alert(t.cameraNotLoggedInTitle, t.cameraNotLoggedInMessage);
      return;
    }

    if (!activePatientId) {
      Alert.alert(t.cameraNoPatientTitle, t.cameraNoPatientMessage);
      return;
    }

    setIsAnalyzing(true);

    try {
      console.log("[1] uploading image...");
      const downloadURL = await uploadPrescriptionImage(
        imageUri, user.uid, activePatientId);
      const analyzeResult = await analyzePrescriptionByUrl(downloadURL);
      console.log("[2] analyzeResult:", analyzeResult);

      const safe = JSON.parse(JSON.stringify(analyzeResult ?? {}));
      const draftTitle = safe.clinic_name ?? t.cameraDefaultDraftTitle;

      console.log("[3] navigate to result draft...");
      console.log("[3] draftTitle =", draftTitle);

      router.replace({
        pathname: "/caregiver/result" as any,
        params: {
          imageUrl: encodeURIComponent(downloadURL),
          draftTitle,
          analyzeResult: JSON.stringify(safe),
        },
      });
    } catch (e: unknown) {
      Alert.alert(t.cameraProcessFailed, userErrorMessage(e, "ocr", language));
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (qrMode) {
    return (
      <View style={styles.qrContainer}>
        <StatusBar barStyle="light-content" />

        <CameraView
          style={styles.qrCamera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleQrScanned}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />

        <SafeAreaView style={styles.qrOverlay} edges={["top", "left", "right", "bottom"]} pointerEvents="box-none">
          <View style={styles.qrTextBox}>
            <Text style={styles.qrTitle}>{t.cameraQrTitle}</Text>
            <Text style={styles.qrHint}>{t.cameraQrHint}</Text>
          </View>
          <Button
            label={t.cameraCancelScan}
            variant="secondary"
            size="lg"
            icon="close"
            fullWidth
            onPress={() => setQrMode(false)}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <AppHeader
        title={t.cameraTitle}
        onBack={() => router.replace(user?.role === "family" ? "/family" : "/caregiver")}
      />

      <ScrollView key={refreshKey} contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>{t.cameraSubtitle}</Text>

        <View style={styles.actions}>
          <Button label={t.cameraTakePhoto} icon="camera" size="lg" fullWidth onPress={takePhoto} />
          <Button label={t.cameraPickImage} icon="image-outline" size="lg" variant="secondary" fullWidth onPress={pickImage} />
          <Button label={t.cameraScanQr} icon="qr-code-outline" size="lg" variant="secondary" fullWidth onPress={openQrScanner} />
        </View>

        {imageUri ? (
          <View style={styles.previewWrap}>
            <Card padding={spacing.sm}>
              <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="contain" />
            </Card>

            <Button
              label={isAnalyzing ? t.cameraAnalyzing : t.cameraStartAnalyze}
              icon="sparkles-outline"
              size="lg"
              fullWidth
              onPress={goNext}
              loading={isAnalyzing}
            />
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="image-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t.cameraNoImage}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  container: {
    padding: layout.screenPaddingX,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
  },
  subtitle: { ...typography.body, color: colors.textSecondary },
  actions: { gap: spacing.md },

  previewWrap: { gap: spacing.lg },
  previewImg: { width: "100%", height: 380, borderRadius: radii.control },

  emptyBox: {
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.card,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: "center" },

  // Camera preview: keep a dark backdrop so the viewfinder reads clearly.
  qrContainer: { flex: 1, backgroundColor: colors.text },
  qrCamera: { flex: 1 },
  qrOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  qrTextBox: {
    alignItems: "center",
    backgroundColor: colors.overlay,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  qrTitle: { ...typography.title, color: colors.onPrimary, textAlign: "center" },
  qrHint: { ...typography.body, color: colors.onPrimary, marginTop: spacing.sm, textAlign: "center" },
});

export default function GuardedCameraScreen() {
  return <PrescriptionWriteGuard><CameraScreen /></PrescriptionWriteGuard>;
}
