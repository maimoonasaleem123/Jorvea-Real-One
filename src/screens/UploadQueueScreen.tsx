/**
 * Optional: Upload Queue Screen
 * Shows current upload progress and queue
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import BackgroundVideoProcessor from '../services/BackgroundVideoProcessor';

const UploadQueueScreen: React.FC = () => {
  const [queueStatus, setQueueStatus] = useState({ total: 0, current: null });

  useEffect(() => {
    const interval = setInterval(() => {
      const status = BackgroundVideoProcessor.getInstance().getQueueStatus();
      setQueueStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const renderCurrentJob = () => {
    if (!queueStatus.current) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="check-circle" size={64} color="#4CAF50" />
          <Text style={styles.emptyText}>No uploads in progress</Text>
          <Text style={styles.emptySubtext}>All your reels are up to date!</Text>
        </View>
      );
    }

    const job = queueStatus.current;
    const progress = Math.round(job.progress * 100);
    const statusIcons = {
      queued: 'schedule',
      converting: 'movie-filter',
      uploading: 'cloud-upload',
      complete: 'check-circle',
      failed: 'error',
    };

    return (
      <View style={styles.currentJobContainer}>
        <View style={styles.currentJobHeader}>
          <Icon name={statusIcons[job.status]} size={32} color="#007AFF" />
          <View style={styles.currentJobInfo}>
            <Text style={styles.currentJobTitle}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Text>
            <Text style={styles.currentJobCaption} numberOfLines={1}>
              {job.caption || 'Untitled reel'}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {job.status === 'converting' && (
          <Text style={styles.statusText}>
            🎬 Converting to HLS format with multiple qualities...
          </Text>
        )}
        {job.status === 'uploading' && (
          <Text style={styles.statusText}>
            ☁️ Uploading optimized video to cloud...
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Upload Queue</Text>
        <Text style={styles.headerSubtitle}>
          {queueStatus.total} {queueStatus.total === 1 ? 'video' : 'videos'} in queue
        </Text>
      </View>

      {renderCurrentJob()}

      {queueStatus.total > 1 && (
        <View style={styles.queueInfo}>
          <Icon name="schedule" size={20} color="#666" />
          <Text style={styles.queueInfoText}>
            {queueStatus.total - 1} more {queueStatus.total - 1 === 1 ? 'video' : 'videos'} waiting
          </Text>
        </View>
      )}

      <View style={styles.infoCard}>
        <Icon name="info-outline" size={24} color="#007AFF" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Background Processing</Text>
          <Text style={styles.infoText}>
            Your videos are being processed in the background. You can close this screen and continue using the app. We'll notify you when each upload is complete!
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  currentJobContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  currentJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentJobInfo: {
    flex: 1,
    marginLeft: 12,
  },
  currentJobTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  currentJobCaption: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 12,
    minWidth: 45,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
  },
  queueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  queueInfoText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    margin: 20,
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default UploadQueueScreen;
