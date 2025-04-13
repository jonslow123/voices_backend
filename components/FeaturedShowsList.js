import React, { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import FeaturedShowTile from './FeaturedShowTile';

const FeaturedShowsList = () => {
  const [shows, setShows] = useState([]);

  useEffect(() => {
    const fetchShows = async () => {
      const response = await fetch('http://192.168.0.7:4000/api/featured-shows');
      const data = await response.json();
      console.log(data);
      console.log(response);
      setShows(data);
    };

    fetchShows();
  }, []);

  return (
    <FlatList
      data={shows}
      renderItem={({ item }) => <FeaturedShowTile show={item} />}
      keyExtractor={(item) => item._id}
    />
  );
};

export default FeaturedShowsList; 