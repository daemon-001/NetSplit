import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';
import { StatusBadge } from '../components/StatusBadge';

type CategoryFilter = 'ALL' | 'ADAPTER' | 'RULE' | 'SERVICE' | 'APPLICATION' | 'SYSTEM';

export const ActivityScreen: React.FC = () => {
  const [selectedCat, setSelectedCat] = useState<CategoryFilter>('ALL');

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const activities = useNetSplitStore((state) => state.activities);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const categories: CategoryFilter[] = ['ALL', 'RULE', 'ADAPTER', 'APPLICATION', 'SERVICE', 'SYSTEM'];

  const filteredList = activities.filter((act) => {
    if (selectedCat === 'ALL') return true;
    return act.category.toUpperCase() === selectedCat;
  });

  return (
    <View style={styles.container}>
      {/* Category Filter Pills */}
      <View style={[styles.filterBar, { backgroundColor: theme.surfaceCard, borderBottomColor: theme.border }]}>
        <Text style={[styles.filterLabel, { color: theme.textTertiary }]}>FILTER EVENTS:</Text>
        <View style={styles.pillsRow}>
          {categories.map((cat) => {
            const isActive = selectedCat === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.pill,
                  {
                    backgroundColor: isActive ? theme.surfaceActive : 'transparent',
                    borderColor: isActive ? theme.borderStrong : theme.borderSubtle,
                  },
                ]}
                onPress={() => setSelectedCat(cat)}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color: isActive ? theme.textPrimary : theme.textSecondary,
                      fontWeight: isActive ? typography.weights.semibold : typography.weights.regular,
                    },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Events List */}
      <FlatList
        data={filteredList.slice().reverse()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.eventCard,
              {
                backgroundColor: theme.surfaceCard,
                borderBottomColor: theme.borderSubtle,
              },
            ]}
          >
            <View style={styles.eventHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <StatusBadge status={item.level} size="sm" />
                <View style={[styles.catBadge, { backgroundColor: theme.surfaceSubtle }]}>
                  <Text style={[styles.catText, { color: theme.textTertiary }]}>{item.category}</Text>
                </View>
                <Text style={[styles.eventTitle, { color: theme.textPrimary }]}>{item.title}</Text>
              </View>
              <Text style={[styles.timestamp, { color: theme.textTertiary }]}>
                {item.timestamp}
              </Text>
            </View>

            <Text style={[styles.eventMessage, { color: theme.textSecondary }]}>
              {item.message}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No activity records found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
              Audit events will appear here as rules and adapters change.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginRight: 12,
  },
  pillsRow: {
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: 6,
  },
  pillText: {
    fontFamily: typography.fontFamily,
    fontSize: 11,
  },
  eventCard: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    marginHorizontal: 8,
  },
  catText: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },
  eventTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  timestamp: {
    fontFamily: typography.fontFamilyMono,
    fontSize: 11,
  },
  eventMessage: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  emptySubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
});
