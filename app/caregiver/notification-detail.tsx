import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatCreatedAt(value: string) {
  if (!value) return "";
  const ts = Number(value);
  if (Number.isNaN(ts)) return "";
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEventTime(hour: string, minute: string, period: string) {
  if (!hour || !minute || !period) return "";
  return `${hour}:${minute} ${period}`;
}

export default function CaregiverNotificationDetailScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();

  const title = firstValue(params.title);
  const body = firstValue(params.body);
  const createdAt = firstValue(params.createdAt);
  const eventName = firstValue(params.eventName);
  const personName = firstValue(params.personName);
  const location = firstValue(params.location);
  const hour = firstValue(params.hour);
  const minute = firstValue(params.minute);
  const period = firstValue(params.period);

  const displayTime = formatEventTime(hour, minute, period) || formatCreatedAt(createdAt);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>{title || "Notification details"}</Text>
          {!!body && <Text style={styles.body}>{body}</Text>}

          <View style={styles.metaList}>
            {!!displayTime && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Time</Text>
                <Text style={styles.metaValue}>{displayTime}</Text>
              </View>
            )}

            {!!eventName && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Event</Text>
                <Text style={styles.metaValue}>{eventName}</Text>
              </View>
            )}

            {!!personName && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Name</Text>
                <Text style={styles.metaValue}>{personName}</Text>
              </View>
            )}

            {!!location && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Location</Text>
                <Text style={styles.metaValue}>{location}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F2F0",
  },
  header: {
    backgroundColor: "#D9D4F3",
    height: 112,
    paddingTop: 54,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    fontSize: 24,
    color: "#374151",
    fontWeight: "700",
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
  },
  metaList: {
    gap: 10,
    marginTop: 6,
  },
  metaRow: {
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  metaValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
});
